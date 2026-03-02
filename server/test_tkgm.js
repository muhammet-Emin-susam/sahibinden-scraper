const axios = require('axios');
async function run() {
    const TKGM_BASE_URL = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/';
    const tkgmHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://parselsorgu.tkgm.gov.tr/',
        'Accept': 'application/json, text/plain, */*'
    };
    try {
        const resp = await axios.get(`${TKGM_BASE_URL}idariYapi/ilListe`, { headers: tkgmHeaders });
        console.log("SUCCESS");
    } catch(err) {
        console.log("STATUS:", err.response?.status);
        console.log("DATA:", err.response?.data);
        console.log("TYPEOF DATA:", typeof err.response?.data);
        if (err.response?.data && typeof err.response.data === 'string' && err.response.data.includes('limitini')) {
            console.log("MATCHED");
        } else {
            console.log("NOT MATCHED");
        }
    }
}
run();
