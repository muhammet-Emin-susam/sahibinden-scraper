const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, orderBy, limit } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCZP0Kj_hU5gza6qdNz5cVsA9MdmQL0ZWU",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "sahibinden-252de.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "sahibinden-252de",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "sahibinden-252de.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "463213159555",
    appId: process.env.FIREBASE_APP_ID || "1:463213159555:web:3a017cf6126e2680fde7b6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
    const q = query(collection(db, "listings"), orderBy("scrapedAt", "desc"), limit(5));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
        console.log(d.data().scrapedAt, d.data().url, d.data().sellerName, d.data().sellerPhone);
    });
    process.exit(0);
}
check();
