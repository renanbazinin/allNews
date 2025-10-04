let lastTap = 0;
const doubleTapDelay = 300; // milliseconds between taps to be considered a double-tap
let touchStartX = 0;
let touchStartY = 0;
let isTouchMoved = false;
let touchTimeout = null;
let isDoubleClickDetected = false;
let currentDisplayMode = 'list'; // Default mode
let lastSuccessfulUpdate = null;
let lastUpdatedAnimationInterval = null;

// Default font size, no longer stored in localStorage
let currentFontSize = 16; // Default size

function formatMilitaryTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatFetchTimestamp(date) {
    return `${date.toLocaleString()}`;
}

// Display mode is declared at the top of the file

let newsData = {};  // Object to store news items for each source
let fetchIntervalId = null;
let refreshClickCount = 0;
const maxRefreshClicks = 3;
const refreshCooldownTime = 60000; // 60 seconds

// Auto-refresh functionality
let isAutoRefreshEnabled = false; // Default: auto-refresh is OFF
const autoRefreshInterval = 30000; // 30 seconds

function setDisplayMode(mode) {
    currentDisplayMode = mode;
    displayNewsItems(); // Re-render news items in the new mode
}

async function fetchNews(endpoint, newsType) {
    const checkbox = document.getElementById(`${endpoint}-checkbox`);
    if (!checkbox || !checkbox.checked) {
        console.log(`Source ${newsType} (${endpoint}) is deselected, skipping fetch.`);
        return;
    }

    try {
        updateLastUpdatedTime(false); // Start the loading animation
        document.getElementById('loading-gif').style.display = 'block';

        const response = await fetch(`https://allnews-server.onrender.com/${endpoint}`);
        const newsItems = await response.json();
        document.getElementById('loading-gif').style.display = 'none';

        if (!checkbox.checked) {
            return; // Skip storing if deselected during fetch
        }

        // Store and display news
        newsData[endpoint] = newsItems.map(item => ({ ...item, newsType }));
        displayNewsItems();
    } catch (error) {
        document.getElementById('loading-gif').style.display = 'none';
        console.error(`Error fetching news from ${newsType} (${endpoint}):`, error);
        throw error; // Propagate error to `fetchSelectedNews`
    }
}

function toggleSourceSelection(endpoint, newsType) {
    const checkbox = document.getElementById(`${endpoint}-checkbox`);

    if (checkbox && checkbox.checked) {
        console.log(`Selecting source: ${newsType} (${endpoint})`);
        fetchNews(endpoint, newsType);  
    } else {
        console.log(`Deselecting source: ${newsType} (${endpoint})`);

        if (newsData[endpoint]) {
            delete newsData[endpoint]; 
            console.log(`Deleted news data for ${newsType}:`, newsData);
        }

        displayNewsItems(); 
    }
}

function adjustFontSize(change) {
    // Get all elements whose font size we want to adjust
    const newsContainer = document.getElementById('news-container');
    const newsItems = document.querySelectorAll('.news-item, .news-item-list');
    const descriptions = document.querySelectorAll('.news-description p');
    
    // Update the current font size
    currentFontSize = parseInt(currentFontSize) + change;
    
    // Enforce min/max boundaries for readability
    if (currentFontSize < 12) currentFontSize = 12;
    if (currentFontSize > 24) currentFontSize = 24;
    
    // Apply the font size to the container
    newsContainer.style.fontSize = `${currentFontSize}px`;
    
    // Apply specific font size adjustments to different elements
    newsItems.forEach(item => {
        // Scale headings proportionally
        const heading = item.querySelector('h2');
        if (heading) {
            heading.style.fontSize = `${currentFontSize + 2}px`;
        }
        
        // Set paragraph sizes directly
        const paragraphs = item.querySelectorAll('p:not(.publisher):not(.fetch-timestamp)');
        paragraphs.forEach(p => {
            p.style.fontSize = `${currentFontSize}px`;
        });
    });
    
    // Apply specific size to descriptions which may have different styling
    descriptions.forEach(desc => {
        desc.style.fontSize = `${currentFontSize}px`;
    });
    
    // Show visual feedback that the font size changed
    showFontSizeFeedback();
}

function showFontSizeFeedback() {
    // Create or get the feedback element
    let feedbackEl = document.getElementById('font-size-feedback');
    
    if (!feedbackEl) {
        feedbackEl = document.createElement('div');
        feedbackEl.id = 'font-size-feedback';
        feedbackEl.style.position = 'fixed';
        feedbackEl.style.bottom = '120px';
        feedbackEl.style.left = '50%';
        feedbackEl.style.transform = 'translateX(-50%)';
        feedbackEl.style.background = 'rgba(0,0,0,0.7)';
        feedbackEl.style.color = 'white';
        feedbackEl.style.padding = '10px 20px';
        feedbackEl.style.borderRadius = '20px';
        feedbackEl.style.zIndex = '1000';
        feedbackEl.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(feedbackEl);
    }
    
    // Display current font size
    feedbackEl.textContent = `Font size: ${currentFontSize}px`;
    feedbackEl.style.opacity = '1';
    
    // Hide after a delay
    clearTimeout(window.fontSizeFeedbackTimeout);
    window.fontSizeFeedbackTimeout = setTimeout(() => {
        feedbackEl.style.opacity = '0';
    }, 1500);
}

async function fetchSelectedNews(justRefresh = true) {
    // Start the refresh spinner
    if (typeof startRefreshSpinner === 'function') {
        startRefreshSpinner();
    }
    
    const endpoints = [
        'bbc', 'nyt', 'ynet', 'maariv', 'n12', 'rotter', 'walla', 'calcalist', 'haaretz'
    ];

    let allFetchSucceeded = true; // Track overall fetch success
    const failedEndpoints = []; // Track failed endpoints

    for (const endpoint of endpoints) {
        const checkbox = document.getElementById(`${endpoint}-checkbox`);
        if (checkbox && checkbox.checked) {
            try {
                await fetchNews(endpoint, checkbox.name);
            } catch (error) {
                allFetchSucceeded = false; // Mark as failed if any fetch fails
                failedEndpoints.push(`${checkbox.name} (${endpoint})`); // Record the endpoint
            }
        }
    }

    if (failedEndpoints.length > 0) {
        displayFetchErrors(failedEndpoints); // Display errors if any
    } else {
        clearFetchErrors(); // Clear previous errors if all succeed
    }

    if (allFetchSucceeded) {
        lastSuccessfulUpdate = new Date(); // Update only if all fetches succeed
    }

    updateLastUpdatedTime(allFetchSucceeded); // Pass success state to determine display
    filterNews();

    // Stop the refresh spinner when all fetching is complete
    if (typeof stopRefreshSpinner === 'function') {
        stopRefreshSpinner();
    }
}

function displayFetchErrors(failedEndpoints) {
    let errorContainer = document.getElementById('error-container');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'error-container';
        errorContainer.style.color = 'red';
        errorContainer.style.marginBottom = '10px';
        const searchContainer = document.getElementById('search-container');
        searchContainer.parentNode.insertBefore(errorContainer, searchContainer);
    }
    errorContainer.innerHTML = `Failed to fetch news from: ${failedEndpoints.join(', ')}`;
}

function clearFetchErrors() {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.remove();
    }
}

function detectLanguage(text) {
    if (!text) return 'ltr'; // Default to LTR if no text
    
    // Hebrew characters are in the range \u0590-\u05FF
    const hebrewRegex = /[\u0590-\u05FF]/;
    return hebrewRegex.test(text) ? 'rtl' : 'ltr';
}

function displayNewsItems() {
    const newsContainer = document.getElementById('news-container');
    
    // Save expanded state before wiping content
    const expandedItems = {};
    if (currentDisplayMode === 'list') {
        const currentDescriptions = document.querySelectorAll('.news-description');
        currentDescriptions.forEach(desc => {
            if (desc.style.display === 'block') {
                const index = desc.id.replace('description-', '');
                expandedItems[index] = true;
            }
        });
    }
    
    newsContainer.innerHTML = '';
    
    let allNewsItems = [];
    
    for (const source in newsData) {
        if (newsData[source] && Array.isArray(newsData[source])) {
            allNewsItems = allNewsItems.concat(newsData[source]);
        }
    }

    allNewsItems.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
        const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
        
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            return b.timestamp - a.timestamp;
        }
        
        return dateB - dateA;
    });

    allNewsItems.forEach((item, index) => {
        const pubDate = new Date(item.pubDate);
        const militaryTime = formatMilitaryTime(pubDate);
        const newsItem = document.createElement('div');
        
        const titleDir = detectLanguage(item.title);
        const descDir = detectLanguage(item.description);
        
        const isHebrewSource = ['ynet', 'maariv', 'n12', 'rotter', 'walla', 'calcalist', 'haaretz'].includes(item.newsType);
        
        if (currentDisplayMode === 'list') {
            newsItem.classList.add('news-item-list');
            newsItem.setAttribute('data-index', index);

            const description = (item.newsType === 'maariv') ? "" : item.description;
            
            newsItem.innerHTML = `
                <p dir="${titleDir}"><strong>${militaryTime}</strong> - ${escapeQuotes(item.title)} <span class="publisher">(<a href="${item.link}" target="_blank">${item.source}</a>)</span></p>
                <div class="news-description" id="description-${index}" style="display: none;">
                    <p dir="${descDir}">${escapeQuotes(description)}</p>
                    ${description && description.trim() !== "" ? `<a href="${item.link}" target="_blank" class="read-more-link">Read more</a>` : ''}
                </div>
                ${description && description.trim() === "" ? `<div class="read-more-container"><a href="${item.link}" target="_blank" class="read-more-link">Read more</a></div>` : ''}
            `;

            if (description && description.trim() !== "") {
                newsItem.addEventListener('click', function() {
                    toggleDescription(index);
                });
                newsItem.classList.add('clickable');
            }
        } else {
            newsItem.classList.add('news-item');
            newsItem.setAttribute('dir', isHebrewSource ? 'rtl' : 'ltr');
            
            newsItem.innerHTML = `
                <h2 dir="${titleDir}"><span class="news-time">[${militaryTime}]</span> ${escapeQuotes(item.title)}</h2>
                <p dir="${descDir}">${escapeQuotes(item.description)}</p>
                <a href="${item.link}" target="_blank">Read more</a>
                <p>Published on: ${pubDate.toLocaleString()}</p>
                ${item.thumbnail ? `<img src="${item.thumbnail}" alt="Thumbnail">` : ''}
                <p class="fetch-timestamp">Fetched on: ${formatFetchTimestamp(new Date())}</p>
                <p class="publisher">Publisher: ${item.source}</p>
            `;
        }

        if (isHebrewSource) {
            newsItem.classList.add('hebrew-source');
        } else {
            newsItem.classList.add('english-source');
        }        newsContainer.appendChild(newsItem);
        
        // Restore expanded state if this item was expanded before
        if (currentDisplayMode === 'list' && expandedItems[index]) {
            const descriptionDiv = document.getElementById(`description-${index}`);
            if (descriptionDiv) {
                descriptionDiv.style.display = 'block';
            }
        }
    });
    
    filterNewsWithoutInput();
    applyStoredFontSize();
}

function applyStoredFontSize() {
    // If we have a saved font size preference, apply it to the newly displayed items
    try {
        const newsContainer = document.getElementById('news-container');
        const newsItems = document.querySelectorAll('.news-item, .news-item-list');
        const descriptions = document.querySelectorAll('.news-description p');
        
        newsContainer.style.fontSize = `${currentFontSize}px`;
        
        newsItems.forEach(item => {
            const heading = item.querySelector('h2');
            if (heading) {
                heading.style.fontSize = `${currentFontSize + 2}px`;
            }
            
            const paragraphs = item.querySelectorAll('p:not(.publisher):not(.fetch-timestamp)');
            paragraphs.forEach(p => {
                p.style.fontSize = `${currentFontSize}px`;
            });
        });
        
        descriptions.forEach(desc => {
            desc.style.fontSize = `${currentFontSize}px`;
        });
    } catch (error) {
        console.error('Error applying stored font size:', error);
        // Continue with default font size
    }
}

function toggleDescription(index) {
    const descriptionDiv = document.getElementById(`description-${index}`);
    if (descriptionDiv.style.display === 'none') {
        descriptionDiv.style.display = 'block';
    } else {
        descriptionDiv.style.display = 'none';
    }
}

function escapeQuotes(str) {
    return str.replace(/<\/?[^>]+(>|$)/g, '').replace(/"/g, '').replace(/'/g, '');
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function refreshNews(calledByUser=false) {
    refreshClickCount++;
    if (refreshClickCount > maxRefreshClicks) {
        document.getElementById('last-updated').textContent = "Please wait a bit, you are clicking too much";
        return;
    }

    fetchSelectedNews(calledByUser);
    updateLastUpdatedTime();  

    setTimeout(() => {
        refreshClickCount = 0;
    }, refreshCooldownTime);
}

function toggleAutoRefresh() {
    isAutoRefreshEnabled = !isAutoRefreshEnabled;
    const toggleButton = document.getElementById('auto-refresh-toggle');
    
    if (isAutoRefreshEnabled) {
        // Enable auto-refresh
        toggleButton.classList.remove('auto-refresh-off');
        toggleButton.classList.add('auto-refresh-on');
        toggleButton.title = 'Auto-refresh enabled (every 30s) - Click to disable';
        
        // Start auto-refresh interval
        startAutoRefresh();
        
        console.log('Auto-refresh enabled');
    } else {
        // Disable auto-refresh
        toggleButton.classList.remove('auto-refresh-on');
        toggleButton.classList.add('auto-refresh-off');
        toggleButton.title = 'Auto-refresh disabled - Click to enable';
        
        // Stop auto-refresh interval
        stopAutoRefresh();
        
        console.log('Auto-refresh disabled');
    }
}

function startAutoRefresh() {
    // Clear any existing interval first
    stopAutoRefresh();
    
    fetchIntervalId = setInterval(async () => {
        console.log("Auto-refreshing news sources...");
        
        const endpoints = [
            'bbc', 'nyt', 'ynet', 'maariv', 'n12', 'rotter', 'walla', 'calcalist', 'haaretz'
        ];
        
        for (const endpoint of endpoints) {
            const checkbox = document.getElementById(`${endpoint}-checkbox`);
            if (checkbox && checkbox.checked) {
                try {
                    console.log(`Auto-refresh fetching news for: ${checkbox.name}`);
                    await fetchNews(endpoint, checkbox.name);
                } catch (error) {
                    console.error(`Auto-refresh error for ${endpoint}:`, error);
                }
            }
        }
        
        updateLastUpdatedTime(); // Update time with every auto-refresh
        filterNews(); // Apply current filters after refresh
    }, autoRefreshInterval);
}

function stopAutoRefresh() {
    if (fetchIntervalId) {
        clearInterval(fetchIntervalId);
        fetchIntervalId = null;
        console.log('Auto-refresh interval cleared');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const checkboxes = document.querySelectorAll('#buttons-container input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    setupCheckboxHandlers();
    
    checkboxes.forEach(checkbox => {
        const endpoint = checkbox.id.replace('-checkbox', '');
        toggleSourceSelection(endpoint, checkbox.name);
    });
    
    updateLastUpdatedTime();
    refreshNews();
    
    // Initialize auto-refresh button state (default: OFF)
    const autoRefreshButton = document.getElementById('auto-refresh-toggle');
    if (autoRefreshButton) {
        autoRefreshButton.classList.add('auto-refresh-off');
        autoRefreshButton.classList.remove('auto-refresh-on');
        autoRefreshButton.title = 'Auto-refresh disabled - Click to enable';
    }

    // If URL contains ?stream=true -> enable auto-refresh, slightly zoom out and scroll down
    try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            const streamParam = params.get('stream');
            if (streamParam && String(streamParam).toLowerCase() === 'true') {
                // enable auto refresh and update UI
                isAutoRefreshEnabled = true;
                if (autoRefreshButton) {
                    autoRefreshButton.classList.remove('auto-refresh-off');
                    autoRefreshButton.classList.add('auto-refresh-on');
                    autoRefreshButton.title = 'Auto-refresh enabled (every 30s) - Click to disable';
                }

                // start the auto-refresh loop
                try {
                    startAutoRefresh();
                } catch (e) {
                    console.error('Failed to start auto-refresh from stream param', e);
                }

                // apply a small zoom-out for more content (best-effort, null-proof)
                try {
                    // non-standard but widely supported
                    document.body.style.zoom = '95%';
                } catch (e) {
                    try {
                        document.documentElement.style.transform = 'scale(0.95)';
                        document.documentElement.style.transformOrigin = 'top center';
                    } catch (err) {
                        // ignore if cannot apply
                    }
                }

                // scroll down a bit so content is visible; delay slightly to let layout settle
                setTimeout(() => {
                    try { window.scrollBy(0, 195); } catch (e) { /* ignore */ }
                }, 1050);
            }
        }
    } catch (err) {
        console.error('Error parsing URL parameters for stream mode:', err);
    }

      // Apply saved font size if exists
    try {
        const newsContainer = document.getElementById('news-container');
        newsContainer.style.fontSize = `${currentFontSize}px`;
    } catch (error) {
        console.error('Error accessing localStorage in DOMContentLoaded:', error);
        // Continue with default font size
    }
    
    window.addEventListener('scroll', function() {
        const scrollToTopButton = document.getElementById('scroll-to-top');
        const footer = document.querySelector('footer');
        if (window.scrollY > 10) {
            footer.classList.add('scrolled');
            scrollToTopButton.style.display = 'flex';
        } else {
            footer.classList.remove('scrolled');
            scrollToTopButton.style.display = 'none';
        }
    });
});

function setupCheckboxHandlers() {
    const labels = document.querySelectorAll('#buttons-container label');
    
    labels.forEach(label => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        
        const sourceId = checkbox.id.replace('-checkbox', '');
        const sourceName = checkbox.name;
        
        // Clone label to remove any existing listeners
        const newLabel = label.cloneNode(true);
        label.parentNode.replaceChild(newLabel, label);
        
        // Get the checkbox from the cloned label
        const newCheckbox = newLabel.querySelector('input[type="checkbox"]');

        // --- State variables per label instance ---
        let lastTapTime = 0; // For mobile double-tap detection
        let currentTouchStartX = 0; // Renamed to avoid conflict if global was still there
        let currentTouchStartY = 0; // Renamed
        let currentIsTouchMoved = false; // Renamed
        let tapTimer = null; // Timer for mobile single tap
        let isDoubleTapActioned = false; // Mobile: true if double tap was handled by touchstart

        let isDesktopDoubleClickDetected = false; // For desktop double-click detection
        // --- End State variables ---

        // MOBILE TOUCH HANDLING
        if ('ontouchstart' in window) {
            newLabel.addEventListener('touchstart', function(event) {
                currentIsTouchMoved = false;
                currentTouchStartX = event.touches[0].clientX;
                currentTouchStartY = event.touches[0].clientY;
                
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTapTime;
                
                if (tapLength < doubleTapDelay && tapLength > 0) { // Double tap
                    event.preventDefault();
                    clearTimeout(tapTimer); // Clear pending single tap from the first tap
                    isDoubleTapActioned = true; 
                    
                    // Visual feedback for double tap
                    newLabel.classList.add('highlight-selection');
                    setTimeout(() => {
                        newLabel.classList.remove('highlight-selection');
                    }, 300);
                    
                    selectOnlyThisSource(sourceId, sourceName);
                    lastTapTime = 0; // Reset lastTapTime to prevent immediate re-trigger with a third tap
                } else { // Potentially first tap or single tap
                    lastTapTime = currentTime;
                    isDoubleTapActioned = false; // Reset for a new tap sequence
                }
            });
            
            newLabel.addEventListener('touchmove', function(event) {
                const xDiff = Math.abs(event.touches[0].clientX - currentTouchStartX);
                const yDiff = Math.abs(event.touches[0].clientY - currentTouchStartY);
                
                if (xDiff > 10 || yDiff > 10) {
                    currentIsTouchMoved = true;
                }
            });
            
            newLabel.addEventListener('touchend', function(event) {
                if (!currentIsTouchMoved) {
                    clearTimeout(tapTimer); 
                    
                    if (isDoubleTapActioned) {
                        // Double tap was handled by touchstart, reset flag for next interaction sequence
                        isDoubleTapActioned = false; 
                    } else {
                        // This is a potential single tap.
                        // Set a timer. If a second 'touchstart' (completing a double tap)
                        // occurs before this timer fires, that 'touchstart' will clear this timer.
                        // If this timer fires, it's a confirmed single tap.
                        tapTimer = setTimeout(() => {
                            newCheckbox.checked = !newCheckbox.checked;
                            toggleSourceSelection(sourceId, sourceName);
                        }, doubleTapDelay);
                    }
                }
            });
            
            // Prevent default checkbox behavior as we're handling it ourselves
            newCheckbox.addEventListener('click', function(event) {
                event.preventDefault();
            });
        }
        
        // DESKTOP MOUSE HANDLING
        // Use separate click and dblclick handlers for desktop
        if (!('ontouchstart' in window) || window.navigator.maxTouchPoints === 0) {
            newLabel.addEventListener('dblclick', function(event) {
                event.preventDefault();
                isDesktopDoubleClickDetected = true;
                
                // Visual feedback
                newLabel.classList.add('highlight-selection');
                setTimeout(() => {
                    newLabel.classList.remove('highlight-selection');
                }, 300);
                
                selectOnlyThisSource(sourceId, sourceName);
                
                // Reset after a short delay, allowing click handler to see the flag
                setTimeout(() => {
                    isDesktopDoubleClickDetected = false;
                }, 250); // Slightly more than click's timeout
            });
            
            newLabel.addEventListener('click', function(event) {
                event.preventDefault();
                
                setTimeout(() => {
                    if (!isDesktopDoubleClickDetected) {
                        newCheckbox.checked = !newCheckbox.checked;
                        toggleSourceSelection(sourceId, sourceName);
                    }
                }, 200); 
            });
        }
    });
}

function selectOnlyThisSource(selectedEndpoint, selectedNewsType) {
    const checkboxes = document.querySelectorAll('#buttons-container input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    const selectedCheckbox = document.getElementById(`${selectedEndpoint}-checkbox`);
    selectedCheckbox.checked = true;
    
    newsData = {};
    fetchNews(selectedEndpoint, selectedNewsType);
}

function filterNews() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    filterNewsByQuery(query);
}

function filterNewsWithoutInput() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    filterNewsByQuery(query);
}

function filterNewsByQuery(query) {
    const newsContainer = document.getElementById('news-container');
    const allNewsItems = newsContainer.querySelectorAll('.news-item, .news-item-list');
    
    allNewsItems.forEach(item => {
        const title = item.querySelector('p, h2').innerText.toLowerCase();
        const description = item.querySelector('.news-description p') ? item.querySelector('.news-description p').innerText.toLowerCase() : '';
        
        if (title.includes(query) || description.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// Variables are now declared at the top of the file

function startLoadingAnimation() {
    const lastUpdatedElement = document.getElementById('last-updated');
    let dots = 0;
    stopLoadingAnimation();

    lastUpdatedAnimationInterval = setInterval(() => {
        dots = (dots % 3) + 1;
        lastUpdatedElement.textContent = `Last Updated: Fetching${'.'.repeat(dots)}`;
    }, 500);
}

function stopLoadingAnimation() {
    clearInterval(lastUpdatedAnimationInterval);
    lastUpdatedAnimationInterval = null;
}

function updateLastUpdatedTime(finalTime = true) {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (finalTime) {
        if (lastSuccessfulUpdate) {
            lastSuccessfulUpdate = new Date()
            const formattedTime = lastSuccessfulUpdate.toLocaleTimeString('en-US', { hour12: false });
            lastUpdatedElement.textContent = `Last Updated: ${formattedTime}`;
            console.log(`Last Updated Time set to: ${formattedTime}`);
        } else {
            lastUpdatedElement.textContent = `Last Updated: None`;
            console.log('No successful updates yet.');
        }
        stopLoadingAnimation();
    } else {
        startLoadingAnimation();
    }
}
