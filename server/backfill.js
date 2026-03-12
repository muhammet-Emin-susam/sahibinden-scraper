require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, updateDoc } = require('firebase/firestore');

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

const DB_COLLECTION = "listings";
const DB_DEMANDS = "demands";

async function backfillMatches() {
    try {
        console.log("Fetching demands...");
        const demandsSnap = await getDocs(collection(db, DB_DEMANDS));
        const demands = demandsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        console.log(`Found ${demands.length} demands.`);
        let updatedCount = 0;

        for (const demand of demands) {
            let matchedListings = demand.matchedListings || [];
            let needsUpdate = false;

            for (let i = 0; i < matchedListings.length; i++) {
                let l = matchedListings[i];
                if (!l.sellerName || !l.ilanNo) {
                    console.log(`Fetching record ${l.listingId} to backfill missing fields...`);
                    try {
                        const recordRef = doc(db, DB_COLLECTION, l.listingId);
                        const recordSnap = await getDoc(recordRef);
                        if (recordSnap.exists()) {
                            const recordData = recordSnap.data();
                            l.sellerName = recordData.sellerName || '';
                            l.sellerPhone = recordData.sellerPhone || '';
                            l.ilanNo = recordData.properties?.['İlan No'] || '';
                            needsUpdate = true;
                        }
                    } catch (e) {
                        console.log(`Error fetching record ${l.listingId}:`, e.message);
                    }
                }
            }

            if (needsUpdate) {
                console.log(`Updating demand ${demand.id}...`);
                const demandRef = doc(db, DB_DEMANDS, demand.id);
                await updateDoc(demandRef, { matchedListings });
                updatedCount++;
            }
        }

        console.log(`Done! Updated ${updatedCount} demands.`);
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

backfillMatches();
