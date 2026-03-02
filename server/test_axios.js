const axios = require('axios');
async function run() {
    const TKGM_BASE_URL = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/';
    const tkgmHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    try {
        const resp = await axios.get(`${TKGM_BASE_URL}parsel/128128/99999/99999`, { headers: tkgmHeaders });
        console.log("SUCCESS:", resp.data);
    } catch(err) {
        console.error("ERROR STATUS:", err.response?.status);
        console.error("ERROR DATA:", err.response?.data);
    }
}
run();
