const puppeteer = require('puppeteer');

async function scrapeProvinces() {
    console.log("Starting browser...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Intercept API responses
    page.on('response', async (response) => {
        if (response.url().includes('idariYapi/ilListe')) {
            try {
                const data = await response.json();
                console.log("---- INTERCEPTED API YANITI ----");
                const balikesir = data.features.find(f => f.properties.text.toLowerCase().includes('bal'));
                console.log(JSON.stringify(balikesir, null, 2));
            } catch (e) {
                console.log("Error parsing response:", e.message);
            }
        }
    });

    console.log("Navigating to parselsorgu...");
    await page.goto('https://parselsorgu.tkgm.gov.tr', { waitUntil: 'networkidle2' });
    
    // Wait a bit just in case
    await new Promise(r => setTimeout(r, 2000));
    
    // If we didn't intercept, try to grab it from the DOM select element
    const options = await page.evaluate(() => {
        const select = document.querySelector('select[name="il"]');
        if (!select) return [];
        return Array.from(select.options).map(o => ({ value: o.value, text: o.text }));
    });
    
    if (options.length > 0) {
        console.log("---- DOM İL SEÇENEKLERİ ----");
        const balikesir = options.find(o => o.text.toLowerCase().includes('bal'));
        console.log(balikesir);
    }
    
    await browser.close();
}

scrapeProvinces();
