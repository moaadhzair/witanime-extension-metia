const axios = require('axios');

exports.handler = async function(event, context) {
  // Check if search keyword is provided
  if (!event.queryStringParameters || !event.queryStringParameters.keyword) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Search keyword is required' })
    };
  }

  try {
    const keyword = event.queryStringParameters.keyword;
    const baseUrl = 'https://witanime.cyou/?search_param=animes&s=';
    const searchUrl = baseUrl + encodeURIComponent(keyword);

    // Fetch HTML content from the search URL
    const response = await axios.get(searchUrl);
    if (response.status !== 200) {
      throw new Error('Network response was not ok');
    }
    const htmlText = response.data;

    // Use jsdom since DOMParser is not available in Node
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(htmlText);
    const doc = dom.window.document;

    // Select all anime card containers
    const animeCards = doc.querySelectorAll('.anime-card-container');
    const animeList = [];

    animeCards.forEach(card => {
      try {
        const titleElement = card.querySelector('.anime-card-title h3 a');
        const title = titleElement?.textContent.trim() || null;
        const session = titleElement?.href || null;

        const imgElement = card.querySelector('.anime-card-poster img');
        const poster = imgElement?.src || null;

        animeList.push({
          title,
          session,
          poster
        });
      } catch (e) {
        console.warn('Failed to parse an anime card:', e);
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify(animeList)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
} 