import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
    const q = query(collection(db, "sahibinden_records"), limit(2));
    const snap = await getDocs(q);
    snap.forEach(doc => {
        console.log("ID:", doc.id);
        const data = doc.data();
        console.log("mainCategory:", data.mainCategory);
        console.log("subCategory:", data.subCategory);
        console.log("transactionType (calculated from categories?):", data.categories);
        console.log("location:", data.location);
        console.log("price:", data.price);
        console.log("properties:", JSON.stringify(data.properties).slice(0, 100));
        console.log("---");
    });
}
check();
