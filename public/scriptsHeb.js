function formatMilitaryTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatFetchTimestamp(date) {
    return `${date.toLocaleString()}`;
}

let currentNewsItems = [];
let fetchIntervalId = null;

async function fetchNews(endpoint, newsType) {
    try {
        document.getElementById('loading-gif').style.display = 'block';

        //const response = await fetch(`http://localhost:3000/${endpoint}`);
        //const response = await fetch(`https://allnews-production.up.railway.app/${endpoint}`);
        const response = await fetch(`https://allnews-server.onrender.com/${endpoint}`);

        //const response = await fetch(`https://all-news.glitch.me//${endpoint}`);
        
        const newsItems = await response.json();
        document.getElementById('loading-gif').style.display = 'none';

        const fetchTime = new Date();
        const fetchTimestamp = formatFetchTimestamp(fetchTime);

        // Check if there are new items and add them to the current news items
        let newItemsAdded = false;
        newsItems.forEach(item => {
            const existingItem = currentNewsItems.find(news => news.title === item.title);
            if (!existingItem) {
                currentNewsItems.push(item);
                newItemsAdded = true;
                console.log("Added new item:", item.title);
            }
        });

        if (newItemsAdded) {
            // Sort the news items by pubDate descending
            currentNewsItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

            // Update the news container
            const newsContainer = document.getElementById('news-container');
            newsContainer.innerHTML = `<h1>${newsType}</h1>`;
            currentNewsItems.forEach(item => {
                const pubDate = new Date(item.pubDate);
                const militaryTime = formatMilitaryTime(pubDate);
                const newsItem = document.createElement('div');
                newsItem.classList.add('news-item');
                newsItem.innerHTML = `
                    <h2>[${militaryTime}] : ${item.title}</h2>
                    <p>${item.description}</p>
                    <a href="${item.link}" target="_blank">Read more</a>
                    <p>Published on: ${pubDate.toLocaleString()}</p>
                    ${item.thumbnail ? `<img src="${item.thumbnail}" alt="Thumbnail"><p class="fetch-timestamp">Fetched on: ${fetchTimestamp}</p>` : `<p class="fetch-timestamp">Fetched on: ${fetchTimestamp}</p>`}
                    ${endpoint === 'all-news-heb' ? `<p>Source: ${item.source}</p>` : ''}
                `;
                newsContainer.appendChild(newsItem);
            });

            console.log('News items fetched and displayed.');
        } else {
            console.log('No new items.');
        }
    } catch (error) {
        document.getElementById('loading-gif').style.display = 'none';

        console.error(`Error fetching news from ${endpoint}:`, error);
    }
}

function startFetchingNews(endpoint, newsType) {
    if (fetchIntervalId !== null) {
        clearInterval(fetchIntervalId);
    }


    const newsContainer = document.getElementById('news-container');
    if (endpoint === 'bbc' || endpoint === 'nyt') {
        newsContainer.setAttribute('dir', 'ltr');
    } else {
        newsContainer.setAttribute('dir', 'rtl');
    }


    currentNewsItems = [];
    document.getElementById('news-container').innerHTML = `<h1>${newsType}</h1>`;
    fetchNews(endpoint, newsType);

    fetchIntervalId = setInterval(() => {
        fetchNews(endpoint, newsType);
    }, 30000);
}

document.addEventListener('DOMContentLoaded', function() {
    function addClickListener(selector, endpoint, newsType) {
        const button = document.querySelector(selector);
        if (button) {
            button.addEventListener('click', () => {
                startFetchingNews(endpoint, newsType);
            });
        } else {
            console.error(`Button not found: ${selector}`);
        }
    }

    addClickListener('button[onclick*="bbc"]', 'bbc', 'BBC News');
    addClickListener('button[onclick*="nyt"]', 'nyt', 'NYT News');

    addClickListener('button[onclick*="ynet"]', 'ynet', 'Ynet News');
    addClickListener('button[onclick*="maariv"]', 'maariv', 'Maariv News');
    addClickListener('button[onclick*="n12"]', 'n12', 'N12 News');
    addClickListener('button[onclick*="rotter"]', 'rotter', 'Rotter News');
    addClickListener('button[onclick*="walla"]', 'walla', 'Walla News');
    addClickListener('button[onclick*="walla"]', 'walla', 'Walla News');
    addClickListener('button[onclick*="calcalist"]', 'calcalist', 'Calcalist News');
    addClickListener('button[onclick*="haaretz"]', 'haaretz', 'Haaretz News');
    addClickListener('button[onclick*="all-news-heb"]', 'all-news-heb', 'All News');


    startFetchingNews('all-news-heb', 'All News');
});

