const express = require('express');
const { fetchBBCNewsRSS, fetchNYTNewsRSS,fetchYnetNewsRSS, fetchMaarivNewsRSS,fetchN12NewsRSS,fetchRotterNewsRSS ,fetchWallaNewsRSS, fetchCalcalistNewsRSS,fetchHaaretzNewsRSS} = require('./fetchNews');
const path = require('path');
const cors = require('cors');


const app = express();
const port = process.env.PORT || 3000;

// Use CORS middleware
app.use(cors());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});


app.get('/bbc', async (req, res) => {
    try {
        const newsItems = await fetchBBCNewsRSS();
        res.json(newsItems);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

app.get('/nyt', async (req, res) => {
    try {
        const newsItems = await fetchNYTNewsRSS();
        res.json(newsItems);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

app.get('/ynet', async (req, res) => {
    const news = await fetchYnetNewsRSS();
    res.json(news);
});


app.get('/maariv', async (req, res) => {
    const news = await fetchMaarivNewsRSS();
    res.json(news);
});


app.get('/n12', async (req, res) => {
    const news = await fetchN12NewsRSS();
    res.json(news);
});

app.get('/rotter', async (req, res) => {
    const news = await fetchRotterNewsRSS();
    res.json(news);
});

app.get('/walla', async (req, res) => {
    const news = await fetchWallaNewsRSS();
    res.json(news);
});

app.get('/calcalist', async (req, res) => {
    const news = await fetchCalcalistNewsRSS();
    res.json(news);
});

app.get('/haaretz', async (req, res) => {
    const news = await fetchHaaretzNewsRSS();
    res.json(news);
});

app.get('/all-news', async (req, res) => {
    try {
        const [
            bbcNews, nytNews, ynetNews, 
            maarivNews, n12News, rotterNews, wallaNews, calcalistNews,haaretzNews // Add this line
        ] = await Promise.all([
            fetchBBCNewsRSS(), fetchNYTNewsRSS(),  fetchYnetNewsRSS(), 
            fetchMaarivNewsRSS(), fetchN12NewsRSS(), fetchRotterNewsRSS(), fetchWallaNewsRSS(),
            fetchCalcalistNewsRSS(),fetchHaaretzNewsRSS() // Add this line
        ]);

        const allNews = [
            ...bbcNews, ...nytNews, ...ynetNews, 
            ...maarivNews, ...n12News, ...rotterNews, ...wallaNews, ...calcalistNews, ...haaretzNews // Add this line
        ];

        allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        const latestNews = allNews.slice(0, 50);
        
        res.json(latestNews);
    } catch (error) {
        console.error('Error fetching all news:', error);
        res.status(500).send('Error fetching all news');
    }
});

app.get('/all-news-heb', async (req, res) => {
    try {
        const [
            ynetNews, 
            maarivNews, n12News, rotterNews, wallaNews, calcalistNews, haaretzNews // Add this line
        ] = await Promise.all([
            fetchYnetNewsRSS(), 
            fetchMaarivNewsRSS(), fetchN12NewsRSS(), fetchRotterNewsRSS(), fetchWallaNewsRSS(),
            fetchCalcalistNewsRSS(),fetchHaaretzNewsRSS() // Add this line
        ]);

        const allNews = [
            ...ynetNews, 
            ...maarivNews, ...n12News, ...rotterNews, ...wallaNews, ...calcalistNews, ...haaretzNews // Add this line
        ];

        allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        const latestNews = allNews.slice(0, 50);
        
        res.json(latestNews);
    } catch (error) {
        console.error('Error fetching all news:', error);
        res.status(500).send('Error fetching all news');
    }
});

app.get('/rotterraw', async (req, res) => {
    try {

        res.json("bla");
    } catch (error) {

        res.status(500).send('Error fetching Rotter news HTML');
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

