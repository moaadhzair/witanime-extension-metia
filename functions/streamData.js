const axios = require('axios');

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
    const response = await axios.get(sessionUrl);
    if (response.status !== 200) {
      throw new Error('Network response was not ok');
    }
    const htmlText = response.data;

    // Use jsdom to parse the HTML
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(htmlText);
    const doc = dom.window.document;

    // Find the script tags
    const scripts = doc.querySelectorAll('script');
    let _zG = null;
    let _zH = null;

    for (const script of scripts) {
      const content = script.textContent;
      // Extract _zG
      if (content.includes('var _zG')) {
        const match = content.match(/var _zG="(.*)";v/);
        if (match && match[1]) {
          _zG = match[1];
        }
      }
      // Extract _zH
      if (content.includes('var _zH')) {
        const match = content.match(/var _zH="(.*)";/);
        if (match && match[1]) {
          _zH = match[1];
        }
      }
    }

    if (!_zG || !_zH) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Stream data not found' })
      };
    }

    // Get server names from nav-tabs
    const serverElements = doc.querySelectorAll('#episode-servers .server-link');
    const serverNames = Array.from(serverElements).map(element => ({
      name: element.querySelector('.ser').textContent.trim(),
      id: element.getAttribute('data-server-id')
    }));

    const decodedUrls = getAllDecodedServers(_zG, _zH);
    
    // Match server names with decoded URLs
    const servers = await Promise.all(serverNames.map(async (server, index) => {
      const url = decodedUrls[index] || null;
      
      console.log(server.name);
      if (server.name.toLowerCase().startsWith('streamwish') && url) {
        const hlsUrl = await streamwishExtractor(url);
        
        console.log(hlsUrl);
        return {
          name: server.name,
          url: hlsUrl
        };
      }
      return {
        name: server.name,
        url: url
      };
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        servers: servers
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

function getAllDecodedServers(_zG, _zH) {
    const decodedServers = [];
    
    resourceRegistry = JSON.parse(atob(_zG))
    configRegistry = JSON.parse(atob(_zH))
    
    Object.keys(resourceRegistry).forEach(key => {
        const resourceData = resourceRegistry[key];
        const configSettings = configRegistry[key];

        if (!resourceData || !configSettings) return;

        let cleaned = resourceData.split('').reverse().join('');
        cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');

        const indexKey = atob(configSettings.k);
        const offset = configSettings.d[parseInt(indexKey, 10)];

        try {
            const decoded = atob(cleaned).slice(0, -offset);
            decodedServers.push(decoded);
        } catch (e) {
            console.warn(`Failed to decode server for key ${key}`, e);
        }
    });

    return decodedServers;
}

async function streamwishExtractor(url) {
    try {
        const response = await axios.get(url);
        if (response.status !== 200) {
            throw new Error('Network response was not ok');
        }
        const htmlText = response.data;

        let m3u8 = "";
        const match = htmlText.match(/eval(.*?)\n<\/script>/s);
        
        if (!match) {
            console.log("No match found");
            return url;
        }

        try {
            const wrapped = `var data = ${match[1]}; data;`;
            const result = eval(wrapped);

            // Extract m3u8 URL
            const m3u8Match = result.match(/hls2":"(.*?)"/);
            m3u8 = m3u8Match ? m3u8Match[1] : null;

            return m3u8 || url;
        } catch (err) {
            console.warn('Failed to extract m3u8:', err);
            return url;
        }
    } catch (error) {
        console.warn('Failed to fetch streamwish page:', error);
        return url;
    }
}
