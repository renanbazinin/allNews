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
        console.log(`Fetching news from ${newsType} (${endpoint})...`);

        const response = await fetch(`https://all-news.glitch.me/${endpoint}`);
        const newsItems = await response.json();
        document.getElementById('loading-gif').style.display = 'none';

        if (!checkbox.checked) {
            console.log(`Source ${newsType} (${endpoint}) was deselected during fetch, not storing data.`);
            return;
        }

        // Store news items
        newsData[endpoint] = newsItems.map(item => {
            item.newsType = newsType;
            return item;
        });

        console.log(`Fetched and stored news from ${newsType}:`, newsData[endpoint]);

        displayNewsItems();
        updateLastUpdatedTime(true); // Final time update on success
        filterNews();
    } catch (error) {
        document.getElementById('loading-gif').style.display = 'none';
        console.error(`Error fetching news from ${newsType} (${endpoint}):`, error);
    
        document.getElementById('last-updated').textContent = `Last Updated: Fetch Failed for ${newsType} (${endpoint})`;
        stopLoadingAnimation();
    }
}


function toggleSourceSelection(endpoint, newsType) {
    const checkbox = document.getElementById(`${endpoint}-checkbox`);

    if (checkbox && checkbox.checked) {
        console.log(`Selecting source: ${newsType} (${endpoint})`);
        fetchNews(endpoint, newsType);  // Fetch the news for the selected source
    } else {
        console.log(`Deselecting source: ${newsType} (${endpoint})`);

        delete newsData[endpoint];  // Remove news from deselected source
        console.log(`Deleted news data for ${newsType}:`, newsData);

        displayNewsItems();  // Update display after removal
    }
}

async function fetchSelectedNews(justRefresh=true) {
    if (fetchIntervalId !== null && !justRefresh) {
        clearInterval(fetchIntervalId);
        fetchIntervalId = null;
    }

    console.log("Starting fetch for selected news sources...");
    const endpoints = [
        'bbc', 'nyt', 'ynet', 'maariv', 'n12', 'rotter', 'walla', 'calcalist', 'haaretz'
    ];

    for (const endpoint of endpoints) {
        const checkbox = document.getElementById(`${endpoint}-checkbox`);
        if (checkbox && checkbox.checked) {
            console.log(`Fetching news for selected source: ${checkbox.name}`);
            await fetchNews(endpoint, checkbox.name);
        }
    }

    updateLastUpdatedTime();  // Ensure the time is updated during auto-refresh

    filterNews();

    if(!justRefresh){
    fetchIntervalId = setInterval(async () => {
        console.log("Auto-refreshing news sources...");
        for (const endpoint of endpoints) {
            const checkbox = document.getElementById(`${endpoint}-checkbox`);
            if (checkbox && checkbox.checked) {
                console.log(`Auto-refresh fetching news for: ${checkbox.name}`);
                await fetchNews(endpoint, checkbox.name);
            }
        }
        updateLastUpdatedTime();  // Update time with every auto-refresh
    }, 30000);
    }
}

function displayNewsItems() {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '';
    
    let allNewsItems = [];
    
    for (const source in newsData) {
        allNewsItems = allNewsItems.concat(newsData[source]);
    }

    allNewsItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    allNewsItems.forEach((item, index) => {
        const pubDate = new Date(item.pubDate);
        const militaryTime = formatMilitaryTime(pubDate);
        const newsItem = document.createElement('div');
        
        if (currentDisplayMode === 'list') {
            newsItem.classList.add('news-item-list');
            newsItem.setAttribute('data-index', index);

            // Special case: Ignore description if source is Maariv and description is empty
            const description = (item.newsType === 'maariv' ) ? "" : item.description;
            newsItem.innerHTML = `
                  <p>${militaryTime} - ${escapeQuotes(item.title)} <span class="publisher">(<a href="${item.link}" target="_blank">${item.source}</a>)</span></p>
                <div class="news-description" id="description-${index}" style="display: none;">
                    <p>${escapeQuotes(description)}</p>
                </div>
            `;

            if (description && description.trim() !== "") {
                newsItem.addEventListener('click', function () {
                    toggleDescription(index);
                });
                newsItem.classList.add('clickable'); // Add a class to indicate it's clickable
            }
        } else {
            // Card mode as previously defined
            newsItem.classList.add('news-item');
            newsItem.innerHTML = `
                <h2>[${militaryTime}] : ${escapeQuotes(item.title)}</h2>
                <p>${escapeQuotes(item.description)}</p>
                <a href="${item.link}" target="_blank">Read more</a>
                <p>Published on: ${pubDate.toLocaleString()}</p>
                ${item.thumbnail ? `<img src="${item.thumbnail}" alt="Thumbnail"><p class="fetch-timestamp">Fetched on: ${formatFetchTimestamp(new Date())}</p>` : `<p class="fetch-timestamp">Fetched on: ${formatFetchTimestamp(new Date())}</p>`}
                <p class="publisher">Publisher: ${item.source}</p>
            `;
        }

        newsContainer.appendChild(newsItem);
    });
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

window.addEventListener('scroll', function() {
    const scrollToTopButton = document.getElementById('scroll-to-top');
    const footer = document.querySelector('footer');
    if (window.scrollY > 10) {
        footer.classList.add('scrolled');
        scrollToTopButton.style.display = 'block';
    } else {
        footer.classList.remove('scrolled');
        scrollToTopButton.style.display = 'none';
    }
});

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

function updateLastUpdatedTime(finalTime = true) {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (finalTime) {
        const lastUpdatedTime = new Date();
        const formattedTime = lastUpdatedTime.toLocaleTimeString('en-US', { hour12: false });
        lastUpdatedElement.textContent = `Last Updated: ${formattedTime}`;
        console.log(`Last Updated Time set to: ${formattedTime}`);
        stopLoadingAnimation(); // Stop animation when fetch succeeds
    } else {
        startLoadingAnimation(); // Start the loading animation
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const checkboxes = document.querySelectorAll('#buttons-container input[type="checkbox"]');
    
    // Select all checkboxes on page load
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });

    // Fetch the selected news and wait for it to complete
    
    checkboxes.forEach(checkbox => {
        toggleSourceSelection(checkbox.name, checkbox.name);
    });


    updateLastUpdatedTime();  // Initialize the last updated time when the page loads
    refreshNews();
});


document.addEventListener('DOMContentLoaded', function() {
    const checkboxes = document.querySelectorAll('#buttons-container input[type="checkbox"]');

    // Add click and double-click event listeners to each checkbox
    checkboxes.forEach(checkbox => {
        const label = checkbox.parentElement;
        label.addEventListener('click', function() {
            toggleSourceSelection(checkbox.id.replace('-checkbox', ''), checkbox.name);
        });
        
        label.addEventListener('dblclick', function() {
            selectOnlyThisSource(checkbox.id.replace('-checkbox', ''), checkbox.name);
        });
    });
});

function selectOnlyThisSource(selectedEndpoint, selectedNewsType) {
    const checkboxes = document.querySelectorAll('#buttons-container input[type="checkbox"]');
    
    // Deselect all checkboxes except the one that was double-clicked
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    const selectedCheckbox = document.getElementById(`${selectedEndpoint}-checkbox`);
    selectedCheckbox.checked = true;
    
    // Clear all news data and fetch only for the selected source
    newsData = {};
    fetchNews(selectedEndpoint, selectedNewsType);
}


function filterNews() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    const newsContainer = document.getElementById('news-container');
    const allNewsItems = newsContainer.querySelectorAll('.news-item, .news-item-list');
    
    allNewsItems.forEach(item => {
        const title = item.querySelector('p, h2').innerText.toLowerCase();
        const description = item.querySelector('.news-description p') ? item.querySelector('.news-description p').innerText.toLowerCase() : '';
        
        if (title.includes(query) || description.includes(query)) {
            item.style.display = ''; // Show the item if it matches the search query
        } else {
            item.style.display = 'none'; // Hide the item if it doesn't match
        }
    });
}


let lastUpdatedAnimationInterval = null; // Store the animation interval

function startLoadingAnimation() {
    const lastUpdatedElement = document.getElementById('last-updated');
    let dots = 0;
    stopLoadingAnimation(); // Ensure any existing animation stops first

    // Start animation loop (adds 1, 2, or 3 dots)
    lastUpdatedAnimationInterval = setInterval(() => {
        dots = (dots % 3) + 1; // Cycle between 1, 2, and 3 dots
        lastUpdatedElement.textContent = `Last Updated: Fetching${'.'.repeat(dots)}`;
    }, 500);
}

function stopLoadingAnimation() {
    clearInterval(lastUpdatedAnimationInterval);
    lastUpdatedAnimationInterval = null;
}

