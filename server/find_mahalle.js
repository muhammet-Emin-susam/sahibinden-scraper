const axios = require('axios');
const PROVINCE_ID = 32; // Balikesir

async function run() {
    try {
        const { data: distData } = await axios.get(`https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/idariYapi/ilceListe/${PROVINCE_ID}`);
        if (!distData.features) return console.log('No districts found.');
        
        for (const feature of distData.features) {
            const ilceId = feature.properties.id;
            const ilceAdi = feature.properties.text;
            
            const { data: mahData } = await axios.get(`https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/idariYapi/mahalleListe/${ilceId}`);
            if (mahData.features) {
                const turna = mahData.features.filter(f => f.properties.text.toLowerCase().includes('turna'));
                if (turna.length > 0) {
                    console.log(`FOUND IN ${ilceAdi} (${ilceId}):`);
                    turna.forEach(t => console.log('  ', JSON.stringify(t.properties)));
                }
            }
        }
    } catch(e) {
        console.error(e.message);
    }
}
run();
