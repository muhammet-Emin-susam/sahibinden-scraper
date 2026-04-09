import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3001'; // Assuming default port
const LOGIN_DATA = {
    username: 'admin', // Adjust if you know another user
    password: 'password' // Adjust
};

async function test() {
    try {
        console.log("Testing Login...");
        const loginRes = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(LOGIN_DATA)
        });
        const loginData = await loginRes.json();
        
        if (!loginData.success) {
            console.error("Login failed:", loginData.error);
            return;
        }
        
        const token = loginData.token;
        console.log("Login successful, token obtained.");

        const testListing = {
            url: 'https://www.sahibinden.com/ilan/emlak-konut-satilik-test-ilan-123',
            ilanNo: 'TEST' + Date.now(),
            title: 'Test Trade Listing',
            price: '1.000.000 TL',
            location: 'İstanbul / Beşiktaş',
            isTrade: true,
            properties: { 'İlan No': 'TEST' + Date.now(), 'Takas': 'Evet' }
        };

        console.log("Testing Save...");
        const saveRes = await fetch(`${API_BASE_URL}/api/save`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(testListing)
        });
        const saveData = await saveRes.json();
        console.log("Save Response:", saveData);

        if (saveData.success) {
            console.log("Listing saved with ID:", saveData.data.id);
            
            console.log("Verifying in /api/records...");
            const recordsRes = await fetch(`${API_BASE_URL}/api/records`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const recordsData = await recordsRes.json();
            const found = recordsData.data.find(r => r.id === saveData.data.id);
            if (found) {
                console.log("SUCCESS: Record found in list.");
                console.log("Entry details:", JSON.stringify(found, null, 2));
            } else {
                console.error("FAILURE: Record NOT found in list.");
                // If it's not found, maybe due to filtering?
                const allRecordsFilteredByIlanNo = recordsData.data.filter(r => r.ilanNo.startsWith('TEST'));
                console.log("All Test Records in list:", allRecordsFilteredByIlanNo.length);
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
