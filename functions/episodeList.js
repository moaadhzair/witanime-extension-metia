const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyUrl = 'http://user-moaadhzair_Tl3H4-country-US:jHcUK=F5C6gLdp4@dc.oxylabs.io:8000';
const agent = new HttpsProxyAgent(proxyUrl);

exports.handler = async function(event, context) {
  // Check if session URL is provided
  if (!event.queryStringParameters || !event.queryStringParameters.session) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Session URL is required' })
    };
  }

  try {
    const sessionUrl = event.queryStringParameters.session;
    
    // Fetch HTML content from the session URL
    const response = await axios.get(sessionUrl, {
      httpsAgent: agent
    });
    if (response.status !== 200) {
      throw new Error('Network response was not ok');
    }
    const htmlText = response.data;

    // Use jsdom to parse the HTML
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(htmlText);
    const doc = dom.window.document;

    // Find the script tag containing processedEpisodeData
    const scripts = doc.querySelectorAll('script');
    let processedEpisodeData = null;

    for (const script of scripts) {
      const content = script.textContent;
      if (content.includes('processedEpisodeData')) {
        // Extract the JSON string from the script
        const match = content.match(/processedEpisodeData\s*=\s*'([^']+)'/);
        if (match && match[1]) {
          processedEpisodeData = match[1];
          break;
        }
      }
    }

    if (!processedEpisodeData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Episode data not found' })
      };
    }

    // Decode and transform the data
    const decodedData = decodeObfuscated(processedEpisodeData);
    const transformedEpisodes = decodedData.map(episode => ({
      cover: episode.screenshot,
      name: `Episode ${episode.number}`,
      link: null,
      id: episode.url,
      dub: false,
      sub: true
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(transformedEpisodes)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

function decodeObfuscated(input) {
    const [part1, part2] = input.split('.');
    const decoded1 = atob(part1);
    const decoded2 = atob(part2);
    let result = '';
    for (let i = 0; i < decoded1.length; i++) {
        result += String.fromCharCode(
            decoded1.charCodeAt(i) ^ decoded2.charCodeAt(i % decoded2.length)
        );
    }
    return JSON.parse(result);
}
