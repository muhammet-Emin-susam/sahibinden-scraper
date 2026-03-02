const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    let apiFound = false;

    page.on('request', request => {
        const url = request.url();
        if (url.includes('api/') || url.includes('ilListe') || url.includes('idariYapi') || url.includes('megsis')) {
            console.log('API Request found:', url);
            apiFound = true;
        }
    });

    console.log('Navigating to parselsorgu...');
    try {
        await page.goto('https://parselsorgu.tkgm.gov.tr/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        console.log('Page Title:', await page.title());
        const content = await page.content();

        if (content.includes('Kabul Ediyorum')) {
            console.log('Terms of service popup detected!');
            // try to click
            await page.click('button:has-text("Kabul Ediyorum")');
            await page.waitForTimeout(2000);
        }

        const ilSelect = await page.$('select[name="il"]');
        if (ilSelect) {
            console.log('il select dropdown exists.');
        } else {
            console.log('il select not found. Dumping body snippet...');
            console.log((await page.textContent('body')).substring(0, 500));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }

    await browser.close();
})();
