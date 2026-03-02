const axios = require('axios');
async function run() {
  try {
    const loginRes = await axios.post('http://localhost:3000/api/login', {username: 'admin', password: 'admin'});
    const token = loginRes.data.token;
    const recordsRes = await axios.get('http://localhost:3000/api/records', { headers: { Authorization: 'Bearer ' + token }});
    const records = recordsRes.data.data;
    records.sort((a,b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
    console.log(records.slice(0, 3).map(r => r.url));
  } catch(e) { console.error(e.message); }
}
run();
