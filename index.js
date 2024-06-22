const express = require('express');
const { fetchBBCNewsRSS, fetchNYTNewsRSS,fetchYnetNewsRSS, fetchMaarivNewsRSS,fetchN12NewsRSS,fetchRotterNewsRSS ,fetchWallaNewsRSS} = require('./fetchNews');
const path = require('path');
const cors = require('cors');


const app = express();
const port = process.env.PORT || 3000;

// Use CORS middleware
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
    try {
        console.log(process.env.PORT);
        res.json("helllll");
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

app.get('/bbc', async (req, res) => {
    try {
        const newsItems = await fetchBBCNewsRSS();
        console.log(newsItems);
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


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

