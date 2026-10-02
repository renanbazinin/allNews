// The web app and Android WebView share this feed and these reading preferences.
const API_BASE = 'https://allnews-server-1018085155010.europe-west3.run.app';
const ENDPOINTS = ['bbc', 'nyt', 'ynet', 'maariv', 'n12', 'rotter', 'walla', 'haaretz'];
const SOURCE_NAMES = { bbc: 'BBC', nyt: 'The New York Times', ynet: 'Ynet', maariv: 'Maariv', n12: 'N12', rotter: 'Rotter', walla: 'Walla', haaretz: 'Haaretz' };
const STORAGE_KEY = 'allnews.reading.v1';
const SAVED_KEY = 'allnews.saved.v1';
const autoRefreshInterval = 30000;

let currentDisplayMode = 'list';
let currentFeedView = 'all';
let currentFontSize = 18;
let lastSuccessfulUpdate = null;
let newsData = {};
let savedArticles = new Map();
let visibleItems = [];
let isAutoRefreshEnabled = false;
let isFetching = false;
let nextFetchScheduled = false;
let currentAbortController = null;
let autoRefreshTimerId = null;
let searchDebounceId = null;
let cycleSourceStates = new Map();
let descriptionSequence = 0;

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key === 'on') Object.entries(value).forEach(([event, handler]) => node.addEventListener(event, handler));
        else node.setAttribute(key, value);
    }
    children.flat().forEach(child => {
        if (child != null && child !== false) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
}

function safeHttpUrl(value) {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
}

// Template content is inert; headlines and summaries are always rendered as text.
function htmlToText(value) {
    if (typeof value !== 'string') return '';
    const template = document.createElement('template');
    template.innerHTML = value;
    return (template.content.textContent || '').trim();
}

function detectLanguage(text) { return /[\u0590-\u05ff]/.test(text) ? 'rtl' : 'ltr'; }
function getItemKey(item) { return `${item.newsType}::${safeHttpUrl(item.link) || ''}::${item.title || ''}`; }
function selectedSources() { return ENDPOINTS.filter(source => document.getElementById(`${source}-checkbox`)?.checked); }
function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function persistPreferences() {
    writeStorage(STORAGE_KEY, { sources: selectedSources(), displayMode: currentDisplayMode, fontSize: currentFontSize, autoRefresh: isAutoRefreshEnabled });
}

function getRelativeTime(date) {
    if (!Number.isFinite(date.getTime())) return 'Latest';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    if (minutes < 2880) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException('Cycle aborted', 'AbortError')); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
    });
}

// A cycle can be cancelled independently of each request's timeout. Transient
// failures retry once, and every timer/listener is released after its attempt.
async function fetchWithRetry(url, { signal: cycleSignal, onRetry, timeoutMs = 40000 } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const abort = () => controller.abort(new DOMException('Cycle aborted', 'AbortError'));
        if (cycleSignal?.aborted) abort();
        else cycleSignal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
        let shouldRetry = false;
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (response.status >= 500 || response.status === 429) {
                if (attempt === 0) shouldRetry = true;
                else throw new Error(`HTTP ${response.status}`);
            } else {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                // Keep the request deadline active while the body is read too.
                return await response.json();
            }
        } catch (error) {
            if (cycleSignal?.aborted || attempt > 0 || /^HTTP 4(?!29)/.test(error.message)) throw error;
            shouldRetry = true;
        } finally {
            clearTimeout(timer);
            cycleSignal?.removeEventListener('abort', abort);
        }
        if (shouldRetry) { onRetry?.(); await sleep(1500, cycleSignal); }
    }
}

async function fetchNews(endpoint, { signal, onRetry } = {}) {
    const items = await fetchWithRetry(`${API_BASE}/${endpoint}`, { signal, onRetry });
    if (!Array.isArray(items)) throw new Error('This source returned an invalid feed');
    if (signal?.aborted || !document.getElementById(`${endpoint}-checkbox`)?.checked) return;
    newsData[endpoint] = items.filter(item => item && typeof item.title === 'string').map(item => ({ ...item, newsType: endpoint }));
    displayNewsItems();
}

async function fetchSelectedNews() {
    if (isFetching) { nextFetchScheduled = true; return; }
    if (autoRefreshTimerId) { clearTimeout(autoRefreshTimerId); autoRefreshTimerId = null; }
    isFetching = true;
    currentAbortController = new AbortController();
    const { signal } = currentAbortController;
    const sources = selectedSources();
    const failed = [];
    const refresh = document.getElementById('refresh-button');
    if (refresh) { refresh.disabled = true; refresh.classList.add('refreshing'); }
    cycleSourceStates = new Map(sources.map(source => [source, 'pending']));
    clearFetchErrors();
    renderStatusLine();
    displayNewsItems();
    try {
        await Promise.all(sources.map(async source => {
            try {
                await fetchNews(source, { signal, onRetry: () => {
                    cycleSourceStates.set(source, 'retrying');
                    renderStatusLine();
                } });
                if (signal.aborted) return;
                cycleSourceStates.set(source, 'loaded');
            } catch (error) {
                if (signal.aborted) return;
                cycleSourceStates.set(source, 'failed');
                failed.push(source);
                displayFetchErrors(failed);
                console.warn(`Unable to refresh ${SOURCE_NAMES[source]}: ${error.message}`);
            }
            renderStatusLine();
        }));
        if (!signal.aborted && [...cycleSourceStates.values()].includes('loaded')) lastSuccessfulUpdate = new Date();
    } finally {
        isFetching = false;
        currentAbortController = null;
        if (refresh) { refresh.disabled = false; refresh.classList.remove('refreshing'); }
        finalizeStatusLine({ aborted: signal.aborted });
        displayNewsItems();
        if (nextFetchScheduled && !document.hidden) {
            nextFetchScheduled = false;
            queueMicrotask(fetchSelectedNews);
        } else {
            nextFetchScheduled = false;
            if (isAutoRefreshEnabled && !document.hidden) scheduleNextFetch();
        }
    }
}

function scheduleNextFetch() {
    clearTimeout(autoRefreshTimerId);
    autoRefreshTimerId = setTimeout(() => {
        autoRefreshTimerId = null;
        if (isAutoRefreshEnabled && !document.hidden) fetchSelectedNews();
    }, autoRefreshInterval);
}
function syncAutoRefreshButton() {
    const button = document.getElementById('auto-refresh-toggle');
    if (button) {
        button.classList.toggle('auto-refresh-on', isAutoRefreshEnabled);
        button.classList.toggle('auto-refresh-off', !isAutoRefreshEnabled);
        button.setAttribute('aria-pressed', String(isAutoRefreshEnabled));
        button.title = isAutoRefreshEnabled ? 'Live updates every 30 seconds. Turn off' : 'Turn on live updates every 30 seconds';
    }
    const label = document.getElementById('auto-refresh-label');
    if (label) label.textContent = isAutoRefreshEnabled ? 'Live on' : 'Live off';
}
function toggleAutoRefresh() {
    isAutoRefreshEnabled = !isAutoRefreshEnabled;
    syncAutoRefreshButton();
    persistPreferences();
    if (isAutoRefreshEnabled) scheduleNextFetch();
    else { clearTimeout(autoRefreshTimerId); autoRefreshTimerId = null; }
}
function refreshNews() { fetchSelectedNews(); }

function displayFetchErrors(sources) {
    const container = document.getElementById('error-container');
    if (!container) return;
    container.classList.add('has-errors');
    container.replaceChildren(`Couldn't update ${sources.map(source => SOURCE_NAMES[source]).join(', ')}. Try again, or choose another source. `,
        el('button', { type: 'button', on: { click: refreshNews } }, 'Try again'));
}
function clearFetchErrors() {
    const container = document.getElementById('error-container');
    if (container) { container.classList.remove('has-errors'); container.replaceChildren(); }
}

function bookmarkIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
}
function syncSaveButton(button, item) {
    const saved = savedArticles.has(getItemKey(item));
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', saved ? 'Remove saved article' : 'Save article');
    button.title = saved ? 'Remove from saved stories' : 'Save for later';
    const label = button.querySelector('.save-label');
    if (label) label.textContent = saved ? 'Saved' : 'Save';
}
function toggleSavedArticle(item) {
    const key = getItemKey(item);
    const removingFocusedSavedItem = currentFeedView === 'saved' && savedArticles.has(key) && document.activeElement?.closest('article')?.dataset.itemKey === key;
    const focusedIndex = visibleItems.findIndex(story => getItemKey(story) === key);
    if (savedArticles.has(key)) savedArticles.delete(key);
    else savedArticles.set(key, {
        title: item.title, description: typeof item.description === 'string' ? item.description : '',
        pubDate: item.pubDate || '', link: safeHttpUrl(item.link) || '', newsType: item.newsType,
        savedAt: Date.now()
    });
    const stored = writeStorage(SAVED_KEY, [...savedArticles.values()]);
    const feedback = document.getElementById('reading-feedback');
    if (feedback) feedback.textContent = stored ? (savedArticles.has(key) ? 'Article saved for later.' : 'Article removed from saved.') : 'Saved for this session. Your browser could not store this on your device.';
    displayNewsItems();
    syncFeedNavigation();
    if (removingFocusedSavedItem) {
        const buttons = document.querySelectorAll('#news-container .save-story');
        const target = buttons[Math.min(focusedIndex, buttons.length - 1)] || document.querySelector('#news-container .empty-state button');
        target?.focus({ preventScroll: true });
    }
}

function buildNewsItemNode(item) {
    const title = htmlToText(item.title) || 'Untitled story';
    const description = htmlToText(item.description);
    const source = ENDPOINTS.includes(item.newsType) ? item.newsType : '';
    const date = new Date(item.pubDate);
    const validDate = Number.isFinite(date.getTime());
    const link = safeHttpUrl(item.link);
    const descriptionId = `story-summary-${++descriptionSequence}`;
    const anchorProps = link ? { href: link, target: '_blank', rel: 'noopener noreferrer' } : {};
    const time = el('time', { class: 'story-time', datetime: validDate ? date.toISOString() : null, title: validDate ? date.toLocaleString() : null }, getRelativeTime(date));
    const save = el('button', { class: 'save-story', type: 'button', on: { click: () => toggleSavedArticle(item) } }, bookmarkIcon(), el('span', { class: 'save-label' }, 'Save'));
    syncSaveButton(save, item);
    const summary = description && description !== title ? el('div', { class: 'story-description', id: descriptionId, hidden: '' }, el('p', { dir: detectLanguage(description), lang: detectLanguage(description) === 'rtl' ? 'he' : 'en' }, description)) : null;
    const summaryToggle = summary ? el('button', {
        type: 'button', class: 'summary-toggle', 'aria-expanded': 'false', 'aria-controls': descriptionId,
        on: { click: event => {
            const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
            event.currentTarget.setAttribute('aria-expanded', String(!expanded));
            event.currentTarget.textContent = expanded ? 'Summary +' : 'Close −';
            summary.hidden = expanded;
            summary.closest('article').classList.toggle('expanded', !expanded);
        } }
    }, 'Summary +') : null;
    const article = el('article', {
        class: currentDisplayMode === 'list' ? 'news-item-list' : 'news-item',
        dataset: { itemKey: getItemKey(item), source, content: JSON.stringify([item.title, item.description, item.pubDate, item.link]) }
    },
    el('div', { class: 'story-meta' }, el('span', { class: 'source-badge' }, el('span', { class: `source-dot ${source}`, 'aria-hidden': 'true' }), SOURCE_NAMES[source] || 'News'), time),
    el('h2', { class: 'story-title', dir: detectLanguage(title), lang: detectLanguage(title) === 'rtl' ? 'he' : 'en' }, link ? el('a', anchorProps, title) : title),
    summary,
    el('div', { class: 'story-actions' }, el('div', { class: 'story-links' }, summaryToggle, link ? el('a', { ...anchorProps, class: 'read-original-link', 'aria-label': `Read original: ${title}` }, 'Read ↗') : null), save));
    return article;
}

function buildEmptyState(query) {
    const hasSources = selectedSources().length > 0;
    const allFailed = cycleSourceStates.size > 0 && [...cycleSourceStates.values()].every(state => state === 'failed');
    let title, hint, action;
    if (query) {
        title = 'No stories found'; hint = `No ${currentFeedView === 'saved' ? 'saved ' : ''}stories match “${query}”. Try another word or a source name.`;
        action = el('button', { type: 'button', on: { click: clearSearch } }, 'Clear search');
    } else if (currentFeedView === 'saved') {
        title = 'Nothing saved yet'; hint = 'Bookmark a story to save it here.';
        action = el('button', { type: 'button', on: { click: () => setFeedView('all') } }, 'Explore the latest');
    } else if (!hasSources) {
        title = 'Choose your sources'; hint = 'Select a source to see its stories.';
        action = el('button', { type: 'button', on: { click: scrollToSources } }, 'Choose sources');
    } else if (isFetching) {
        title = 'Loading news…'; hint = 'Fetching your selected sources.';
    } else if (allFailed) {
        title = 'News unavailable'; hint = 'Check your connection and try again.';
        action = el('button', { type: 'button', on: { click: refreshNews } }, 'Try again');
    } else {
        title = 'No stories yet'; hint = 'Refresh or choose another source.';
        action = el('button', { type: 'button', on: { click: refreshNews } }, 'Refresh stories');
    }
    return el('div', { class: 'empty-state', role: 'status' }, el('span', { class: 'empty-state-icon', 'aria-hidden': 'true' }, '✳'), el('h2', { class: 'empty-state-text' }, title), el('p', { class: 'empty-state-hint' }, hint), action);
}

function getFeedItems() {
    const items = currentFeedView === 'saved' ? [...savedArticles.values()] : selectedSources().flatMap(source => newsData[source] || []);
    const deduplicated = [...new Map(items.map(item => [getItemKey(item), item])).values()];
    return deduplicated.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
}
function displayNewsItems() {
    const container = document.getElementById('news-container');
    if (!container) return;
    const query = (document.getElementById('search-bar')?.value || '').trim();
    const normalized = query.toLocaleLowerCase();
    visibleItems = getFeedItems().filter(item => !normalized || `${htmlToText(item.title)} ${htmlToText(item.description)} ${SOURCE_NAMES[item.newsType] || ''}`.toLocaleLowerCase().includes(normalized));
    container.classList.toggle('card-view', currentDisplayMode === 'card');
    container.classList.toggle('list-view', currentDisplayMode === 'list');
    container.setAttribute('aria-busy', String(isFetching && currentFeedView === 'all'));
    const existing = new Map([...container.querySelectorAll('article[data-item-key]')].map(node => [node.dataset.itemKey, node]));
    container.querySelectorAll('.empty-state').forEach(node => node.remove());
    const keys = new Set(visibleItems.map(getItemKey));
    existing.forEach((node, key) => { if (!keys.has(key)) node.remove(); });
    let previous = null;
    for (const item of visibleItems) {
        const key = getItemKey(item);
        const fingerprint = JSON.stringify([item.title, item.description, item.pubDate, item.link]);
        let node = existing.get(key);
        if (node && node.dataset.content !== fingerprint) { node.remove(); node = null; }
        if (!node) node = buildNewsItemNode(item);
        node.classList.toggle('news-item-list', currentDisplayMode === 'list');
        node.classList.toggle('news-item', currentDisplayMode === 'card');
        syncSaveButton(node.querySelector('.save-story'), item);
        const target = previous ? previous.nextSibling : container.firstChild;
        if (node !== target) container.insertBefore(node, target);
        previous = node;
    }
    if (!visibleItems.length) container.appendChild(buildEmptyState(query));
    updateNewsCount(query);
    updateSearchClearVisibility();
    syncFeedNavigation();
}

function syncFeedNavigation() {
    updateSourceSummary();
    document.querySelectorAll('[data-feed-view]').forEach(button => {
        const active = button.dataset.feedView === currentFeedView;
        button.classList.toggle('active', active);
        if (button.getAttribute('role') === 'tab') button.setAttribute('aria-selected', String(active));
        else button.setAttribute('aria-pressed', String(active));
    });
    const count = document.getElementById('saved-count');
    if (count) count.textContent = String(savedArticles.size);
    const heading = document.getElementById('feed-title');
    if (heading) heading.textContent = currentFeedView === 'saved' ? 'Saved for later' : 'The latest';
}
function setFeedView(view) {
    if (!['all', 'saved'].includes(view)) return;
    currentFeedView = view;
    displayNewsItems();
}
function setDisplayMode(mode) {
    if (!['list', 'card'].includes(mode)) return;
    currentDisplayMode = mode;
    for (const value of ['list', 'card']) {
        const button = document.getElementById(`${value}-mode-btn`);
        if (button) { button.classList.toggle('active', mode === value); button.setAttribute('aria-pressed', String(mode === value)); }
    }
    persistPreferences();
    displayNewsItems();
}
function updateSourceSummary() {
    const count = selectedSources().length;
    const number = document.getElementById('source-selection-count');
    if (number) number.textContent = `${count} selected`;
    const summary = document.getElementById('source-summary');
    if (summary) summary.textContent = currentFeedView === 'saved' ? 'On this device' : `${count} selected source${count === 1 ? '' : 's'}`;
}
function toggleSourceSelection() {
    persistPreferences();
    updateSourceSummary();
    currentAbortController?.abort();
    displayNewsItems();
    fetchSelectedNews();
}
function setupCheckboxHandlers() {
    ENDPOINTS.forEach(source => {
        const checkbox = document.getElementById(`${source}-checkbox`);
        if (!checkbox) return;
        // Native change events work identically with keyboard, mouse and touch.
        checkbox.removeAttribute('onchange');
        checkbox.addEventListener('change', toggleSourceSelection);
    });
}
function adjustFontSize(change) {
    currentFontSize = Math.min(24, Math.max(14, currentFontSize + change));
    applyFontSize();
    persistPreferences();
}
function applyFontSize() {
    document.documentElement.style.setProperty('--article-font-size', `${currentFontSize}px`);
    const value = document.getElementById('font-size-value');
    if (value) value.textContent = `${currentFontSize}px`;
    const decrease = document.getElementById('decrease-font');
    const increase = document.getElementById('increase-font');
    if (decrease) decrease.disabled = currentFontSize <= 14;
    if (increase) increase.disabled = currentFontSize >= 24;
}
function openReadingSettings() { document.getElementById('reading-settings')?.showModal(); }
function closeReadingSettings() { document.getElementById('reading-settings')?.close(); }

function filterNews() { displayNewsItems(); }
function applyFilter() { displayNewsItems(); }
function clearSearch() {
    const search = document.getElementById('search-bar');
    if (!search) return;
    search.value = '';
    displayNewsItems();
    search.focus();
}
function updateSearchClearVisibility() {
    const clear = document.getElementById('search-clear');
    const hasQuery = !!document.getElementById('search-bar')?.value;
    if (clear) { clear.classList.toggle('visible', hasQuery); clear.hidden = !hasQuery; }
}
function updateNewsCount(query) {
    const count = document.getElementById('news-count');
    if (count) count.textContent = `${visibleItems.length} ${query ? 'result' : 'stor' + (visibleItems.length === 1 ? 'y' : 'ies')}${query && visibleItems.length !== 1 ? 's' : ''}`;
}
function renderStatusLine() {
    const element = document.getElementById('last-updated');
    const label = element?.querySelector('.status-label');
    if (!label) return;
    const states = [...cycleSourceStates.values()];
    const settled = states.filter(state => ['loaded', 'failed'].includes(state)).length;
    const retrying = states.includes('retrying');
    element.classList.toggle('updating', states.length > 0);
    element.classList.toggle('retrying', retrying);
    element.classList.toggle('idle', states.length === 0);
    label.textContent = states.length ? `Updating ${settled}/${states.length}${retrying ? ' · retrying' : ''}` : 'Choose your sources';
}
function finalizeStatusLine({ aborted }) {
    const element = document.getElementById('last-updated');
    const label = element?.querySelector('.status-label');
    if (!label) return;
    element.classList.remove('updating', 'retrying');
    element.classList.add('idle');
    const states = [...cycleSourceStates.values()];
    if (!selectedSources().length) label.textContent = 'Choose your sources';
    else if (states.length && states.every(state => state === 'failed')) label.textContent = 'Update unavailable';
    else if (lastSuccessfulUpdate) label.textContent = `Updated ${lastSuccessfulUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    else label.textContent = aborted ? 'Update paused' : 'Your edition is ready';
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
function scrollToSources() {
    document.getElementById('sources-nav')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearTimeout(autoRefreshTimerId);
        autoRefreshTimerId = null;
        currentAbortController?.abort();
    } else if (isAutoRefreshEnabled || (!lastSuccessfulUpdate && selectedSources().length)) fetchSelectedNews();
});
window.addEventListener('pageshow', event => {
    if (event.persisted && isAutoRefreshEnabled && !document.hidden) fetchSelectedNews();
});

document.addEventListener('DOMContentLoaded', () => {
    const preferences = readStorage(STORAGE_KEY, {});
    const sources = Array.isArray(preferences.sources) ? preferences.sources.filter(source => ENDPOINTS.includes(source)) : ENDPOINTS.filter(source => !['bbc', 'nyt'].includes(source));
    ENDPOINTS.forEach(source => {
        const checkbox = document.getElementById(`${source}-checkbox`);
        if (checkbox) checkbox.checked = sources.includes(source);
    });
    const storedArticles = readStorage(SAVED_KEY, []);
    if (Array.isArray(storedArticles)) storedArticles.forEach(item => {
        if (item && typeof item.title === 'string' && ENDPOINTS.includes(item.newsType)) savedArticles.set(getItemKey(item), item);
    });
    if (Number.isFinite(preferences.fontSize)) currentFontSize = Math.min(24, Math.max(14, preferences.fontSize));
    if (['list', 'card'].includes(preferences.displayMode)) currentDisplayMode = preferences.displayMode;
    isAutoRefreshEnabled = preferences.autoRefresh === true || new URLSearchParams(location.search).get('stream')?.toLowerCase() === 'true';
    setupCheckboxHandlers();
    updateSourceSummary();
    applyFontSize();
    syncAutoRefreshButton();
    setDisplayMode(currentDisplayMode);
    document.getElementById('search-bar')?.addEventListener('input', () => {
        clearTimeout(searchDebounceId);
        searchDebounceId = setTimeout(displayNewsItems, 150);
        updateSearchClearVisibility();
    });
    window.addEventListener('scroll', () => document.getElementById('scroll-to-top')?.classList.toggle('visible', window.scrollY > 400), { passive: true });
    document.addEventListener('keydown', event => {
        const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
        if (event.key === '/' && !editing && !document.getElementById('reading-settings')?.open) {
            event.preventDefault();
            document.getElementById('search-bar')?.focus();
        }
        if (event.key === 'Escape' && document.activeElement?.id === 'search-bar') document.activeElement.blur();
    });
    fetchSelectedNews();
});
