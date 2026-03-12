const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000, // or the port the API is running on
    path: '/api/demands/123/match/456',
    method: 'DELETE',
};

const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', res.statusCode, data));
});

req.on('error', error => console.error('Error:', error));
req.end();
