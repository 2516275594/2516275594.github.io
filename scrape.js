import fs from 'fs';
import fetch from 'node-fetch';
import cheerio from 'cheerio';

const targetUrl = 'https://github.com/crossxx-labs/free-proxy';

async function scrapeProxies() {
  try {
    const res = await fetch(targetUrl);
    const html = await res.text();
    const $ = cheerio.load(html);

    const proxies = [];

    $('tr:has(td)').each((i, row) => {
      const tds = $(row).find('td');
      if (tds.length >= 3) {
        const type = $(tds[0]).text().trim();
        const link = $(tds[1]).find('code').text().trim();
        const date = $(tds[2]).text().trim();

        proxies.push({ type, link, date });
      }
    });

    fs.writeFileSync('data/proxies.json', JSON.stringify(proxies, null, 2));
    console.log('Data saved to data/proxies.json');
  } catch (err) {
    console.error('Error scraping:', err);
  }
}

scrapeProxies();
