const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function check() {
    console.log("Fetching demands...");
    const demandsSnap = await db.collection("demands").limit(2).get();
    demandsSnap.forEach(doc => {
        console.log("DEMAND:", doc.id, JSON.stringify(doc.data(), null, 2));
    });

    console.log("\nFetching records...");
    const recordsSnap = await db.collection("sahibinden_records").limit(2).get();
    recordsSnap.forEach(doc => {
        const data = doc.data();
        console.log("RECORD:", doc.id);
        console.log("  mainCategory:", data.mainCategory);
        console.log("  subCategory:", data.subCategory);
        console.log("  categories:", data.categories);
        console.log("  price:", data.price);
        console.log("  location:", data.location);
    });
}

check();
