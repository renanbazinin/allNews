const axios = require('axios');
const xml2js = require('xml2js');
const iconv = require('iconv-lite');  // Add this line

async function fetchBBCNewsRSS() {
    try {
        const response = await axios.get('https://feeds.bbci.co.uk/news/world/rss.xml');
        const rssData = response.data;

        const parser = new xml2js.Parser({ explicitArray: false, cdata: true });
        const result = await parser.parseStringPromise(rssData);

        const items = result.rss.channel.item;

        // Get the last 30 items
        const latestItems = items.slice(0, 60);

        // Save elements of each item
        const newsItems = latestItems.map(item => ({
            title: item.title && item.title._ ? item.title._ : item.title,
            description: item.description && item.description._ ? item.description._ : item.description,
            link: item.link,
            guid: item.guid._,
            pubDate: item.pubDate,
            thumbnail: item['media:thumbnail'] ? item['media:thumbnail'].$.url : null
        }));

        return newsItems;
    } catch (error) {
        console.error('Error fetching or parsing the RSS feed:', error);
        throw error;
    }
}

async function fetchNYTNewsRSS() {
    try {
        const response = await axios.get('https://rss.nytimes.com/services/xml/rss/nyt/World.xml');
        const rssData = response.data;

        const parser = new xml2js.Parser({ explicitArray: false, cdata: true });
        const result = await parser.parseStringPromise(rssData);

        const items = result.rss.channel.item;

        // Get the last 30 items
        const latestItems = items.slice(0, 60);

        // Save elements of each item
        const newsItems = latestItems.map(item => ({
            title: item.title && item.title._ ? item.title._ : item.title,
            description: item.description && item.description._ ? item.description._ : item.description,
            link: item.link,
            guid: item.guid._,
            pubDate: item.pubDate,
            thumbnail: item['media:content'] ? item['media:content'].$.url : null
        }));

        return newsItems;
    } catch (error) {
        console.error('Error fetching or parsing the RSS feed:', error);
        throw error;
    }
}

async function fetchYnetNewsRSS() {
    try {
        const response = await axios.get('https://www.ynet.co.il/Integration/StoryRss1854.xml');
        const rssData = response.data;

        const parser = new xml2js.Parser({ explicitArray: false, cdata: true });
        const result = await parser.parseStringPromise(rssData);

        const items = result.rss.channel.item;

        // Get the last 30 items
        const latestItems = items.slice(0, 30);

        // Save elements of each item
        const newsItems = latestItems.map(item => ({
            title: item.title,
            description: item.description,
            link: item.link,
            guid: item.guid,
            pubDate: item.pubDate
        }));

        return newsItems;
    } catch (error) {
        console.error('Error fetching or parsing the RSS feed:', error);
        throw error;
    }
}


async function fetchMaarivNewsRSS() {
    try {
        const response = await axios.get('https://www.maariv.co.il/Rss/RssFeedsMivzakiChadashot');
        const rssData = response.data;

        const parser = new xml2js.Parser({ explicitArray: false, cdata: true });
        const result = await parser.parseStringPromise(rssData);

        const items = result.rss.channel.item;

        // Get the last 30 items
        const latestItems = items.slice(0, 30);

        // Save elements of each item
        const newsItems = latestItems.map(item => {
            const imageMatch = item.description.match(/src='([^']+)'/);
            const imageUrl = imageMatch ? imageMatch[1] : null;

            return {
                title: item.title,
                description: item.description.replace(/<img[^>]+>/, '').trim(), // Remove image tag from description
                link: item.link,
                guid: item.guid,
                pubDate: item.pubDate,
                thumbnail: imageUrl
            };
        });

        return newsItems;
    } catch (error) {
        console.error('Error fetching or parsing the RSS feed:', error);
        throw error;
    }



}
async function fetchN12NewsRSS() {
    try {
        const response = await axios.get('https://rcs.mako.co.il/rss/news-military.xml');
        const rssData = response.data;

        const parser = new xml2js.Parser({ explicitArray: false, cdata: true });
        const result = await parser.parseStringPromise(rssData);

        const items = result.rss.channel.item;

        // Get the last 30 items
        const latestItems = items.slice(0, 30);

        // Save elements of each item
        const newsItems = latestItems.map(item => {
            const imageMatch = item.description.match(/src='([^']+)'/);
            const imageUrl = imageMatch ? imageMatch[1] : item.image;

            return {
                title: item.title,
                description: item.description.replace(/<img[^>]+>/, '').trim(), // Remove image tag from description
                link: item.link,
                guid: item.guid,
                pubDate: item.pubDate,
                thumbnail: imageUrl
            };
        });

        return newsItems;
    } catch (error) {
        console.error('Error fetching or parsing the RSS feed:', error);
        throw error;
    }
}

async function fetchRotterNewsRSS() {
    try {
        const response = await axios.get('https://rotter.net/rss/rotternews.xml', { responseType: 'arraybuffer' });
        const rssData = iconv.decode(Buffer.from(response.data), 'windows-1255');  // Decode using 'windows-1255' encoding

        const parser = new xml2js.Parser({ explicitArray: false, cdata: true });
        const result = await parser.parseStringPromise(rssData);

        const items = result.rss.channel.item;

        // Get the last 30 items
        const latestItems = items.slice(0, 30);

        // Save elements of each item
        const newsItems = latestItems.map(item => ({
            title: item.title,
            description: item.description,
            link: item.link,
            guid: item.guid,
            pubDate: item.pubDate
        }));

        return newsItems;
    } catch (error) {
        console.error('Error fetching or parsing the RSS feed:', error);
        throw error;
    }
}


async function fetchWallaNewsRSS() {
    try {
        const response = await axios.get('https://rss.walla.co.il/feed/22');
        const rssData = response.data;

        const parser = new xml2js.Parser({ explicitArray: false, cdata: true });
        const result = await parser.parseStringPromise(rssData);

        const items = result.rss.channel.item;

        // Get the last 30 items
        const latestItems = items.slice(0, 30);

        // Save elements of each item
        const newsItems = latestItems.map(item => {
            const imageMatch = item.description.match(/src="([^"]+)"/);
            const imageUrl = imageMatch ? imageMatch[1] : (item.enclosure ? item.enclosure.url : null);

            return {
                title: item.title.replace('<![CDATA[', '').replace(']]>', ''),
                description: item.description.replace('<![CDATA[', '').replace(']]>', '').replace(/<img[^>]+>/, '').trim(),
                link: item.link.replace('<![CDATA[', '').replace(']]>', ''),
                guid: item.guid.replace('<![CDATA[', '').replace(']]>', ''),
                pubDate: item.pubDate.replace('<![CDATA[', '').replace(']]>', '').replace('GMT', ''),
                thumbnail: imageUrl
            };
        });

        return newsItems;
    } catch (error) {
        console.error('Error fetching or parsing the RSS feed:', error);
        throw error;
    }
}

module.exports = { fetchBBCNewsRSS, fetchNYTNewsRSS,  fetchYnetNewsRSS, fetchMaarivNewsRSS, fetchN12NewsRSS, fetchRotterNewsRSS, fetchWallaNewsRSS };
