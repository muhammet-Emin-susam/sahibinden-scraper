const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Log all console messages
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`Browser Console Error: ${msg.text()}`);
        } else {
            console.log(`Browser Console: ${msg.text()}`);
        }
    });

    // Log all unhandled exceptions within the page
    page.on('pageerror', exception => {
        console.log(`Uncaught exception: "${exception}"`);
    });

    // Navigate to the app (we need to login or at least get the initial error)
    console.log('Navigating to http://localhost:5173/sayfalar/kaydedilenler...');
    try {
        await page.goto('http://localhost:5173/sayfalar/kaydedilenler', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000); // Wait a bit to see if React crashes
    } catch (e) {
        console.log(`Navigation Error: ${e}`);
    }

    await browser.close();
})();
