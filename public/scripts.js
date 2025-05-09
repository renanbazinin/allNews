let lastTap = 0;
const doubleTapDelay = 300; // milliseconds between taps to be considered a double-tap
let touchStartX = 0;
let touchStartY = 0;
let isTouchMoved = false;
let touchTimeout = null;
let isDoubleClickDetected = false;

function formatMilitaryTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatFetchTimestamp(date) {
    return `${date.toLocaleString()}`;
}

let currentDisplayMode = 'list'; // Default mode

let newsData = {};  // Object to store news items for each source
let fetchIntervalId = null;
let refreshClickCount = 0;
const maxRefreshClicks = 3;
const refreshCooldownTime = 60000; // 60 seconds

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

        const response = await fetch(`https://all-news.glitch.me/${endpoint}`);
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
    const newsContainer = document.getElementById('news-container');
    const currentFontSize = window.getComputedStyle(newsContainer, null).getPropertyValue('font-size');
    const newFontSize = parseFloat(currentFontSize) + change;

    if (newFontSize >= 12 && newFontSize <= 24) { // Restrict font size between 12px and 24px for good UX
        newsContainer.style.fontSize = newFontSize + 'px';
    }
}

async function fetchSelectedNews(justRefresh = true) {
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

    if (!justRefresh) {
        fetchIntervalId = setInterval(async () => {
            console.log("Auto-refreshing news sources...");
            for (const endpoint of endpoints) {
                const checkbox = document.getElementById(`${endpoint}-checkbox`);
                if (checkbox && checkbox.checked) {
                    console.log(`Auto-refresh fetching news for: ${checkbox.name}`);
                    await fetchNews(endpoint, checkbox.name);
                }
            }
            updateLastUpdatedTime(); // Update time with every auto-refresh
        }, 30000);
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
                </div>
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
        }

        newsContainer.appendChild(newsItem);
    });
    
    filterNewsWithoutInput();
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

        // MOBILE TOUCH HANDLING
        if ('ontouchstart' in window) {
            // Touch start - record position
            newLabel.addEventListener('touchstart', function(event) {
                isTouchMoved = false;
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                
                // Clear any existing timeout
                clearTimeout(touchTimeout);
                
                if (tapLength < doubleTapDelay && tapLength > 0) {
                    // Double tap detected
                    event.preventDefault();
                    lastTap = 0;
                    
                    // Visual feedback
                    newLabel.classList.add('highlight-selection');
                    setTimeout(() => {
                        newLabel.classList.remove('highlight-selection');
                    }, 300);
                    
                    // Select only this source
                    selectOnlyThisSource(sourceId, sourceName);
                } else {
                    // Single tap - wait to see if it's part of a double-tap
                    lastTap = currentTime;
                    
                    // Set a timeout to handle the tap if a second one doesn't come
                    touchTimeout = setTimeout(() => {
                        if (!isTouchMoved) {
                            // Toggle the checkbox state
                            newCheckbox.checked = !newCheckbox.checked;
                            
                            // Handle the source selection based on new state
                            toggleSourceSelection(sourceId, sourceName);
                        }
                    }, doubleTapDelay);
                }
            }, { passive: false });
            
            // Track if touch moves significantly (to prevent triggering when scrolling)
            newLabel.addEventListener('touchmove', function(event) {
                const xDiff = Math.abs(event.touches[0].clientX - touchStartX);
                const yDiff = Math.abs(event.touches[0].clientY - touchStartY);
                
                // If moved more than 10px in any direction, consider it a scroll, not a tap
                if (xDiff > 10 || yDiff > 10) {
                    isTouchMoved = true;
                    clearTimeout(touchTimeout);
                }
            }, { passive: true });
            
            // Cancel the tap handler if touch is cancelled
            newLabel.addEventListener('touchcancel', function() {
                clearTimeout(touchTimeout);
            }, { passive: true });
        }
        
        // DESKTOP MOUSE HANDLING
        // Use separate click and dblclick handlers for desktop
        if (!('ontouchstart' in window) || window.navigator.maxTouchPoints === 0) {
            // Handle double-click
            newLabel.addEventListener('dblclick', function(event) {
                event.preventDefault();
                isDoubleClickDetected = true;
                
                // Visual feedback
                newLabel.classList.add('highlight-selection');
                setTimeout(() => {
                    newLabel.classList.remove('highlight-selection');
                }, 300);
                
                // Select only this source
                selectOnlyThisSource(sourceId, sourceName);
                
                // Reset after a short delay
                setTimeout(() => {
                    isDoubleClickDetected = false;
                }, 300);
            });
            
            // Handle single click (will not fire if double-click was detected)
            newLabel.addEventListener('click', function(event) {
                // Prevent the default checkbox behavior so we can control it
                event.preventDefault();
                
                // Wait a bit to see if this is part of a double-click
                setTimeout(() => {
                    if (!isDoubleClickDetected) {
                        // Toggle the checkbox manually
                        newCheckbox.checked = !newCheckbox.checked;
                        
                        // Handle the source selection based on new state
                        toggleSourceSelection(sourceId, sourceName);
                    }
                }, 200); // Slightly less than typical double-click time
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

let lastSuccessfulUpdate = null;
let lastUpdatedAnimationInterval = null;

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
