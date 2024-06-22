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
        //const response = await fetch(`http://localhost:3000/${endpoint}`);
        const response = await fetch(`https://allnews-production.up.railway.app/${endpoint}`);

        
        const newsItems = await response.json();

        const fetchTime = new Date();
        const fetchTimestamp = formatFetchTimestamp(fetchTime);

        // Check if there are new items and add them to the current news items
        let newItemsAdded = false;
        newsItems.forEach(item => {
            const existingItem = currentNewsItems.find(news => news.guid === item.guid);
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
                `;
                newsContainer.appendChild(newsItem);
            });

            console.log('News items fetched and displayed.');
        } else {
            console.log('No new items.');
        }
    } catch (error) {
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

window.onload = function() {
    document.querySelector('button[onclick*="bbc"]').addEventListener('click', () => {
        startFetchingNews('bbc', 'BBC News');
    });

    document.querySelector('button[onclick*="nyt"]').addEventListener('click', () => {
        startFetchingNews('nyt', 'NYT News');
    });

    document.querySelector('button[onclick*="cnn"]').addEventListener('click', () => {
        startFetchingNews('cnn', 'CNN News');
    });
    
    document.querySelector('button[onclick*="ynet"]').addEventListener('click', () => {
        startFetchingNews('ynet', 'Ynet News');
    });
    document.querySelector('button[onclick*="maariv"]').addEventListener('click', () => {
        startFetchingNews('maariv', 'Maariv News');
    });

    document.querySelector('button[onclick*="n12"]').addEventListener('click', () => {
        startFetchingNews('n12', 'N12 News');
    });

    document.querySelector('button[onclick*="rotter"]').addEventListener('click', () => {
        startFetchingNews('rotter', 'Rotter News');
    });

    document.querySelector('button[onclick*="walla"]').addEventListener('click', () => {
        startFetchingNews('walla', 'Walla News');
    });

    document.querySelector('button[onclick*="walla"]').addEventListener('click', () => {
        startFetchingNews('all-news', 'All News');
    });

};
