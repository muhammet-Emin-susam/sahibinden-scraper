const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Set headers to try and bypass basic bot detection
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    try {
        await page.goto('https://www.sahibinden.com/ilan/emlak-arsa-satilik-2250-m2-en-uygun-fiyatli-arsa-1299402801/detay', { waitUntil: 'domcontentloaded' });

        // Wait a sec for scripts
        await new Promise(r => setTimeout(r, 2000));

        // Extract everything in the right column
        const rightCol = await page.evaluate(() => {
            const el = document.querySelector('.classifiedDetailRightSide, aside, .classified-right-side');
            return el ? el.innerHTML : 'NOT_FOUND';
        });

        console.log("--- RIGHT COL HTML ---");
        console.log(rightCol);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
