require('dotenv').config();
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, addDoc } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCZP0Kj_hU5gza6qdNz5cVsA9MdmQL0ZWU",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "sahibinden-252de.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "sahibinden-252de",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "sahibinden-252de.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "463213159555",
    appId: process.env.FIREBASE_APP_ID || "1:463213159555:web:3a017cf6126e2680fde7b6",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-DK6XBEPMTW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    try {
        console.log("Trying to read activity_log...");
        const snap = await getDocs(collection(db, "activity_log"));
        console.log("Docs found:", snap.size);

        console.log("Trying to write to activity_log...");
        const docRef = await addDoc(collection(db, "activity_log"), {
            test: true,
            timestamp: new Date().toISOString()
        });
        console.log("Write success! ID:", docRef.id);
    } catch (err) {
        console.error("Firebase Error:", err.message);
    }
    process.exit(0);
}

test();
