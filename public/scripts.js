let lastTap = 0;
const doubleTapDelay = 300; // milliseconds between taps to be considered a double-tap
let touchStartX = 0;
let touchStartY = 0;
let isTouchMoved = false;
let touchTimeout = null;
let isDoubleClickDetected = false;

// Store the user's preferred font size in localStorage
let currentFontSize = localStorage.getItem('newsFontSize') || 16; // Default size

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
    // Get all elements whose font size we want to adjust
    const newsContainer = document.getElementById('news-container');
    const newsItems = document.querySelectorAll('.news-item, .news-item-list');
    const descriptions = document.querySelectorAll('.news-description p');
    
    // Update the current font size
    currentFontSize = parseInt(currentFontSize) + change;
    
    // Enforce min/max boundaries for readability
    if (currentFontSize < 12) currentFontSize = 12;
    if (currentFontSize > 24) currentFontSize = 24;
    
    // Save preference
    localStorage.setItem('newsFontSize', currentFontSize);
    
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
    applyStoredFontSize();
}

function applyStoredFontSize() {
    // If we have a saved font size preference, apply it to the newly displayed items
    if (localStorage.getItem('newsFontSize')) {
        currentFontSize = localStorage.getItem('newsFontSize');
        
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
    
    // Apply saved font size if exists
    if (localStorage.getItem('newsFontSize')) {
        currentFontSize = localStorage.getItem('newsFontSize');
        const newsContainer = document.getElementById('news-container');
        newsContainer.style.fontSize = `${currentFontSize}px`;
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

        // MOBILE TOUCH HANDLING
        if ('ontouchstart' in window) {
            // Track first tap for double-tap detection
            let tappedOnce = false;
            let tapTimer = null;
            
            // Touch start handler for mobile devices
            newLabel.addEventListener('touchstart', function(event) {
                // Mark the touch position to detect if user is scrolling
                isTouchMoved = false;
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                
                // Double tap detection
                if (tapLength < doubleTapDelay && tapLength > 0) {
                    // This is a double tap - clear any pending single tap
                    event.preventDefault();
                    clearTimeout(tapTimer);
                    lastTap = 0;
                    tappedOnce = false;
                    
                    // Visual feedback for double tap
                    newLabel.classList.add('highlight-selection');
                    setTimeout(() => {
                        newLabel.classList.remove('highlight-selection');
                    }, 300);
                    
                    // Apply double-tap action (select only this source)
                    selectOnlyThisSource(sourceId, sourceName);
                } else {
                    // This is potentially a first tap of a double tap
                    // or a single tap - store timestamp for detection
                    lastTap = currentTime;
                }
            });
            
            // Track if touch moves to prevent triggering tap when scrolling
            newLabel.addEventListener('touchmove', function(event) {
                const xDiff = Math.abs(event.touches[0].clientX - touchStartX);
                const yDiff = Math.abs(event.touches[0].clientY - touchStartY);
                
                // If moved more than 10px in any direction, consider it a scroll
                if (xDiff > 10 || yDiff > 10) {
                    isTouchMoved = true;
                }
            });
            
            // Handle touch end to trigger the single tap action if not scrolling
            newLabel.addEventListener('touchend', function(event) {
                if (!isTouchMoved) {
                    // This looks like a deliberate tap (not a scroll)
                    // Wait a short period to see if it's part of a double tap
                    clearTimeout(tapTimer);
                    
                    tapTimer = setTimeout(() => {
                        // If we get here, it was a single tap
                        const currentTime = new Date().getTime();
                        if (currentTime - lastTap >= doubleTapDelay) {
                            // Toggle checkbox state
                            newCheckbox.checked = !newCheckbox.checked;
                            // Update selection after toggle
                            toggleSourceSelection(sourceId, sourceName);
                        }
                    }, doubleTapDelay);
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
            
            // Handle single click
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
