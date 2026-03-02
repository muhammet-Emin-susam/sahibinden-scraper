const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Firebase Imports (using require/compat for Node.js CommonJS environment)
const { initializeApp } = require("firebase/app");
const {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    query,
    orderBy,
    where,
    limit,
    deleteField,
    writeBatch
} = require("firebase/firestore");

const app = express();

// Configure Multer for local storage (using /tmp for Vercel Serverless compatibility)
const uploadsDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir) && process.env.NODE_ENV !== 'production') {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const PORT = process.env.PORT || 3000;
const SESSION_ID = Math.random().toString(36).substring(7).toUpperCase();

console.log(`[SYSTEM] Starting server with SESSION_ID: ${SESSION_ID}`);


// Firebase Config
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCZP0Kj_hU5gza6qdNz5cVsA9MdmQL0ZWU",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "sahibinden-252de.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "sahibinden-252de",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "sahibinden-252de.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "463213159555",
    appId: process.env.FIREBASE_APP_ID || "1:463213159555:web:3a017cf6126e2680fde7b6",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-DK6XBEPMTW"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const DB_COLLECTION = "listings";
const DB_USERS = "users";
const DB_REGIONS = "regions";
const DB_ANNOUNCEMENTS = "announcements";
const DB_ACTIVITY = "activity_log";
const DB_APPOINTMENTS = "appointments";
const DB_DEMANDS = "demands";

const JWT_SECRET = process.env.JWT_SECRET || 'sahibinden-scraper-super-secret-key-123!';

// Activity Log Helper
async function logActivity({ listingId, listingTitle, action, from, to, by, byId }) {
    try {
        await addDoc(collection(db, DB_ACTIVITY), {
            listingId: listingId || '',
            listingTitle: listingTitle || '',
            action,
            from: from ?? null,
            to: to ?? null,
            by: by || '',
            byId: byId || '',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[ACTIVITY LOG ERROR]', err.message);
    }
}

// Listing Categorization Helper
function categorizeListing(data) {
    const properties = data.properties || {};
    const emlakTipi = (properties['Emlak Tipi'] || '').toLowerCase();

    let mainCategory = 'Diğer';
    let subCategory = 'Diğer';

    if (emlakTipi) {
        // 1. OPERATION (İŞLEM) DETECTION - From Emlak Tipi
        if (emlakTipi.includes('devren satılık') || emlakTipi.includes('devren satilik')) mainCategory = 'Devren Satılık';
        else if (emlakTipi.includes('devren kiralık') || emlakTipi.includes('devren kiralik')) mainCategory = 'Devren Kiralık';
        else if (emlakTipi.includes('günlük kiralık') || emlakTipi.includes('gunluk kiralik')) mainCategory = 'Günlük Kiralık';
        else if (emlakTipi.includes('kat karşılığı') || emlakTipi.includes('kat karsiligi')) mainCategory = 'Kat Karşılığı';
        else if (emlakTipi.includes('satılık') || emlakTipi.includes('satilik')) mainCategory = 'Satılık';
        else if (emlakTipi.includes('kiralık') || emlakTipi.includes('kiralik')) mainCategory = 'Kiralık';

        // 2. PROPERTY TYPE (KATEGORİ) DETECTION - From Emlak Tipi
        // Priority to Land types to avoid Konut conflict
        if (emlakTipi.includes('arsa')) subCategory = 'Arsa';
        else if (emlakTipi.includes('tarla') || emlakTipi.includes('arazi')) subCategory = 'Tarla';
        else if (emlakTipi.includes('bahçe') || emlakTipi.includes('bahce')) subCategory = 'Bahçe';
        else if (emlakTipi.includes('bağ') || emlakTipi.includes('bag')) subCategory = 'Bağ';
        else if (emlakTipi.includes('zeytinlik')) subCategory = 'Zeytinlik';
        else if (emlakTipi.includes('daire') || emlakTipi.includes('konut') || emlakTipi.includes('rezidans') || emlakTipi.includes('villa')) subCategory = 'Konut';
        else if (emlakTipi.includes('iş yeri') || emlakTipi.includes('isyeri') || emlakTipi.includes('dükkan') || emlakTipi.includes('ofis')) subCategory = 'İş Yeri';
        else if (emlakTipi.includes('bina')) subCategory = 'Bina';
        else if (emlakTipi.includes('devre mülk') || emlakTipi.includes('devremülk')) subCategory = 'Devre Mülk';
        else if (emlakTipi.includes('turistik') || emlakTipi.includes('otel')) subCategory = 'Turistik Tesis';
    }

    // Minimal fallback for Operation only (if emlakTipi is missing)
    if (mainCategory === 'Diğer') {
        const text = (`${data.title || ''} ${data.url || ''}`).toLowerCase();
        if (text.includes('satılık') || text.includes('satilik')) mainCategory = 'Satılık';
        else if (text.includes('kiralık') || text.includes('kiralik')) mainCategory = 'Kiralık';
    }

    return { mainCategory, subCategory };
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

if (process.env.GEMINI_API_KEY) {
    const maskedKey = process.env.GEMINI_API_KEY.substring(0, 6) + "..." + process.env.GEMINI_API_KEY.slice(-4);
    console.log(`Gemini Model Initialized with key: ${maskedKey}`);
} else {
    console.error("WARNING: GEMINI_API_KEY is not defined in .env file!");
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, 'uploads')));

// Global Exception Handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('!!! UNHANDLED REJECTION !!!', reason);
});

process.on('uncaughtException', (err) => {
    console.error('!!! UNCAUGHT EXCEPTION !!!', err);
});


// Initialize Default Admin User
async function initializeAdminUser() {
    try {
        const usersRef = collection(db, DB_USERS);
        const q = query(usersRef, where("role", "==", "admin"), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No admin user found. Creating default admin/admin...");
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash("admin", salt);

            await addDoc(usersRef, {
                username: "admin",
                password: hashedPassword,
                displayName: "Sistem Yöneticisi",
                color: "#1e293b",
                role: "admin",
                createdAt: new Date().toISOString()
            });
            console.log("Default admin created successfully.");
        }
    } catch (err) {
        console.error("Error initializing admin user:", err);
    }
}
initializeAdminUser();

// JWT Middleware
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Invalid token.' });

        // Check user still exists in DB (handles deleted accounts)
        try {
            const userDoc = await getDoc(doc(db, DB_USERS, user.id));
            if (!userDoc.exists()) {
                return res.status(401).json({ success: false, error: 'USER_DELETED' });
            }
        } catch (dbErr) {
            // If DB check fails, allow request to proceed (don't block on transient errors)
        }

        req.user = user;
        console.log(`[REQUEST][SID:${SESSION_ID}] ${new Date().toISOString()} - ${req.method} ${req.url} (User: ${user.username})`);
        next();
    });
}

// POST: Login route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required.' });

    try {
        const usersRef = collection(db, DB_USERS);
        const q = query(usersRef, where("username", "==", username), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(401).json({ success: false, error: 'Invalid username or password.' });
        }

        const userDoc = snapshot.docs[0];
        const user = userDoc.data();

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid username or password.' });
        }

        const token = jwt.sign(
            { id: userDoc.id, username: user.username, role: user.role, displayName: user.displayName || user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ success: true, token, user: { id: userDoc.id, username: user.username, role: user.role, displayName: user.displayName || user.username } });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Route: Update Admin Credentials
app.put('/api/admin/credentials', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });

    const { newUsername, newPassword, currentPassword } = req.body;

    if (!currentPassword) return res.status(400).json({ success: false, error: 'Current password strongly required.' });

    try {
        // Verify current password first
        const adminDocRef = doc(db, DB_USERS, req.user.id);
        const adminSnap = await getDoc(adminDocRef);
        const adminData = adminSnap.data();

        const validPassword = await bcrypt.compare(currentPassword, adminData.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
        }

        const updateData = {};
        if (newUsername) {
            const q = query(collection(db, DB_USERS), where("username", "==", newUsername), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty && snap.docs[0].id !== req.user.id) {
                return res.status(400).json({ success: false, error: 'Username already taken.' });
            }
            updateData.username = newUsername;
        }

        if (newPassword) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(newPassword, salt);
        }

        if (Object.keys(updateData).length > 0) {
            await updateDoc(adminDocRef, updateData);
        }

        res.json({ success: true, message: 'Credentials updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Route: Create sub-account
app.post('/api/admin/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });

    const { username, password, displayName, color } = req.body;
    if (!username || !password || !displayName || !color) return res.status(400).json({ success: false, error: 'Username, password, display name and color are required.' });

    try {
        const qUser = query(collection(db, DB_USERS), where("username", "==", username), limit(1));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
            return res.status(400).json({ success: false, error: 'Bu kullanıcı adı zaten kullanımda.' });
        }

        const qDisplay = query(collection(db, DB_USERS), where("displayName", "==", displayName), limit(1));
        const snapDisplay = await getDocs(qDisplay);
        if (!snapDisplay.empty) {
            return res.status(400).json({ success: false, error: 'Bu isimde bir kullanıcı zaten mevcut.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newDoc = await addDoc(collection(db, DB_USERS), {
            username,
            password: hashedPassword,
            displayName,
            color,
            role: "user",
            createdAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'User created.', user: { id: newDoc.id, username, displayName, color, role: 'user' } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Route: List users
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });

    try {
        const snap = await getDocs(collection(db, DB_USERS));
        const users = snap.docs.map(document => {
            const d = document.data();
            return { id: document.id, username: d.username, displayName: d.displayName, color: d.color, role: d.role, createdAt: d.createdAt };
        });
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Route: Update user
app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });

    const { id } = req.params;
    const { username, password, displayName, color } = req.body;

    try {
        const docRef = doc(db, DB_USERS, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        const updateData = {};
        if (username) {
            const q = query(collection(db, DB_USERS), where("username", "==", username), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty && snap.docs[0].id !== id) {
                return res.status(400).json({ success: false, error: 'Bu kullanıcı adı zaten kullanımda.' });
            }
            updateData.username = username;
        }

        if (displayName) {
            const q = query(collection(db, DB_USERS), where("displayName", "==", displayName), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty && snap.docs[0].id !== id) {
                return res.status(400).json({ success: false, error: 'Bu isimde bir kullanıcı zaten mevcut.' });
            }
            updateData.displayName = displayName;
        }

        if (color) updateData.color = color;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        await updateDoc(docRef, updateData);
        res.json({ success: true, message: 'User updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- TKGM API Proxy Routes ---
const TKGM_BASE_URL = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/';

// Helper to normalize TKGM responses (some return GeoJSON features, some flat arrays)
const normalizeTKGMData = (data) => {
    if (!data) return [];
    if (data.features) {
        return data.features.map(f => f.properties || f);
    }
    // If it's already an array, return it, otherwise wrap it if it seems to be a single item
    // but usually these endpoints return arrays or GeoJSON.
    return Array.isArray(data) ? data : (data.properties ? [data.properties] : [data]);
};

const tkgmHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://parselsorgu.tkgm.gov.tr/',
    'Accept': 'application/json, text/plain, */*'
};

app.get('/api/tkgm/provinces', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${TKGM_BASE_URL}idariYapi/ilListe`, { headers: tkgmHeaders });
        res.json({ success: true, data: normalizeTKGMData(response.data) });
    } catch (err) {
        if (err.response?.data && typeof err.response.data === 'string' && err.response.data.includes('limitini')) {
            return res.status(429).json({ success: false, error: 'TKGM günlük sorgu limitinizi aştınız. Lütfen VPN kullanın veya farklı bir internet ağına bağlanın.' });
        }
        console.error('TKGM Province error:', err.response?.status, err.message);
        res.status(500).json({ success: false, error: 'TKGM servisine erişilemedi.' });
    }
});

app.get('/api/tkgm/districts/:provinceId', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${TKGM_BASE_URL}idariYapi/ilceListe/${req.params.provinceId}`, { headers: tkgmHeaders });
        res.json({ success: true, data: normalizeTKGMData(response.data) });
    } catch (err) {
        if (err.response?.data && typeof err.response.data === 'string' && err.response.data.includes('limitini')) {
            return res.status(429).json({ success: false, error: 'TKGM günlük sorgu limitinizi aştınız. Lütfen VPN kullanın veya farklı bir ağa bağlanın.' });
        }
        console.error('TKGM District error:', err.response?.status, err.message);
        res.status(500).json({ success: false, error: 'TKGM servisine erişilemedi.' });
    }
});

app.get('/api/tkgm/neighborhoods/:districtId', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${TKGM_BASE_URL}idariYapi/mahalleListe/${req.params.districtId}`, { headers: tkgmHeaders });
        res.json({ success: true, data: normalizeTKGMData(response.data) });
    } catch (err) {
        if (err.response?.data && typeof err.response.data === 'string' && err.response.data.includes('limitini')) {
            return res.status(429).json({ success: false, error: 'TKGM günlük sorgu limitinizi aştınız. Lütfen VPN kullanın veya farklı bir ağa bağlanın.' });
        }
        console.error('TKGM Neighborhood error:', err.response?.status, err.message);
        res.status(500).json({ success: false, error: 'TKGM servisine erişilemedi.' });
    }
});

app.get('/api/tkgm/parcel/:neighborhoodId/:ada/:parsel', authenticateToken, async (req, res) => {
    try {
        const { neighborhoodId, ada, parsel } = req.params;
        const response = await axios.get(`${TKGM_BASE_URL}parsel/${neighborhoodId}/${ada}/${parsel}`, { headers: tkgmHeaders });
        res.json({ success: true, data: normalizeTKGMData(response.data) });
    } catch (err) {
        console.error('TKGM Parcel error URL:', `${TKGM_BASE_URL}parsel/${req.params.neighborhoodId}/${req.params.ada}/${req.params.parsel}`);
        console.error('TKGM Parcel error Status:', err.response?.status);
        console.error('TKGM Parcel error Data:', err.response?.data);

        if (err.response?.data && typeof err.response.data === 'string' && err.response.data.includes('limitini')) {
            return res.status(429).json({ success: false, error: 'TKGM günlük sorgu limitinizi aştınız. Lütfen VPN kullanın veya farklı bir internet ağına bağlanın.' });
        }
        res.status(500).json({ success: false, error: 'TKGM servisine erişilemedi veya parsel bulunamadı.' });
    }
});

// Admin: Delete User (+ all their listings)
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });

    const { id } = req.params;
    if (id === req.user.id) {
        return res.status(400).json({ success: false, error: 'Kendi hesabınızı silemezsiniz.' });
    }

    try {
        const docRef = doc(db, DB_USERS, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
        if (docSnap.data().role === 'admin') {
            return res.status(400).json({ success: false, error: 'Admin hesabı silinemez.' });
        }

        // Delete all listings belonging to this user
        const listingsQuery = query(collection(db, DB_COLLECTION), where('userId', '==', id));
        const listingsSnap = await getDocs(listingsQuery);
        const deletePromises = listingsSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);

        // Delete the user document itself
        await deleteDoc(docRef);

        res.json({ success: true, message: `Kullanıcı ve ${listingsSnap.size} ilanı silindi.` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Public Route: List users for map
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const snap = await getDocs(collection(db, DB_USERS));
        const users = snap.docs.map(document => {
            const d = document.data();
            return { id: document.id, username: d.username, displayName: d.displayName, color: d.color, role: d.role };
        });
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Route: Assign Region
app.post('/api/regions/assign', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required.' });

    const { ilce, mahalle, userId } = req.body;
    if (!ilce || !mahalle) return res.status(400).json({ success: false, error: 'ilce and mahalle are required.' });

    try {
        // Query to see if this mahalle assignment already exists
        const q = query(collection(db, DB_REGIONS), where("ilce", "==", ilce), where("mahalle", "==", mahalle));
        const snap = await getDocs(q);

        if (!userId) {
            // Unassign logic: if userId is empty, delete the existing assignment
            if (!snap.empty) {
                // Delete all documents matching this mahalle (should be just 1)
                snap.docs.forEach(async (docSnap) => {
                    await deleteDoc(doc(db, DB_REGIONS, docSnap.id));
                });
            }
            return res.json({ success: true, message: 'Assignment removed.' });
        } else {
            // Assign or Re-assign logic
            if (snap.empty) {
                // Create new assignment
                await addDoc(collection(db, DB_REGIONS), {
                    ilce,
                    mahalle,
                    userId,
                    updatedAt: new Date().toISOString()
                });
            } else {
                // Update existing assignment
                const docRef = doc(db, DB_REGIONS, snap.docs[0].id);
                await updateDoc(docRef, { userId, updatedAt: new Date().toISOString() });
            }
            return res.json({ success: true, message: 'Assignment saved.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Route: Get Region Assignments (Open to all authenticated users)
app.get('/api/regions/assignments', authenticateToken, async (req, res) => {

    try {
        const snap = await getDocs(collection(db, DB_REGIONS));
        const assignments = snap.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));
        res.json({ success: true, data: assignments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET all records
app.get('/api/records', authenticateToken, async (req, res) => {
    try {
        let q;
        if (req.user.role === 'admin') {
            q = query(collection(db, DB_COLLECTION), orderBy("scrapedAt", "desc"));
        } else {
            // Because Firestore requires a composite index for equality on userId and ordering by scrapedAt
            // we will fetch by userId and sort in-memory to avoid index creation hassles for the user
            q = query(collection(db, DB_COLLECTION), where("userId", "==", req.user.id));
        }

        const querySnapshot = await getDocs(q);

        let records = querySnapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));

        if (req.user.role !== 'admin') {
            records.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
        }

        res.json({ success: true, data: records });
    } catch (err) {
        console.error("Error fetching documents: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST save a new record
app.post('/api/save', authenticateToken, async (req, res) => {
    const newRecord = req.body;

    if (!newRecord || !newRecord.title || !newRecord.url) {
        return res.status(400).json({ success: false, error: 'Invalid data' });
    }

    try {
        let duplicatesSnap;
        // Priority check: Use 'İlan No' if available. It survives title/URL changes.
        if (newRecord.ilanNo) {
            const qByNo = query(
                collection(db, DB_COLLECTION),
                where('userId', '==', req.user.id),
                where('ilanNo', '==', newRecord.ilanNo)
            );
            duplicatesSnap = await getDocs(qByNo);
        }

        // Fallback or legacy check: check by URL if 'İlan No' check was empty
        if (!duplicatesSnap || duplicatesSnap.empty) {
            const qByUrl = query(
                collection(db, DB_COLLECTION),
                where('userId', '==', req.user.id),
                where('url', '==', newRecord.url)
            );
            duplicatesSnap = await getDocs(qByUrl);
        }

        if (!newRecord.forceSave && !duplicatesSnap.empty) {
            return res.status(409).json({
                success: false,
                error: 'DUPLICATE_WARNING',
                message: 'Bu ilan daha önce kaydedilmiş, yine de eklensin mi?'
            });
        }

        // If forced and requested to overwrite, soft-delete old duplicates first taking over their notes
        if (newRecord.forceSave && newRecord.overwrite && !duplicatesSnap.empty) {
            // Inherit notes, status_tag, and aiAnalysis from the latest active duplicate
            const activeDocs = duplicatesSnap.docs.filter(d => d.data().status !== 'deleted');
            if (activeDocs.length > 0) {
                const latestDuplicate = activeDocs.map(d => d.data()).sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt))[0];
                if (latestDuplicate.note) newRecord.note = latestDuplicate.note;
                if (latestDuplicate.status_tag) newRecord.status_tag = latestDuplicate.status_tag;
                if (latestDuplicate.aiAnalysis) newRecord.aiAnalysis = latestDuplicate.aiAnalysis;
            }

            const deletePromises = duplicatesSnap.docs.map(d => {
                return updateDoc(d.ref, {
                    status: 'deleted',
                    previousStatus: d.data().status || (req.user.role === 'admin' ? 'approved' : 'pending'),
                    deletedAt: new Date().toISOString()
                });
            });
            await Promise.all(deletePromises);
            console.log(`[SAVE] Soft-deleted ${duplicatesSnap.size} duplicate entries for ${newRecord.url}`);
        }

        // Enforce timestamp and attribution
        newRecord.scrapedAt = new Date().toISOString();
        newRecord.userId = req.user.id;
        delete newRecord.forceSave;
        delete newRecord.overwrite;
        newRecord.username = req.user.username;
        newRecord.displayName = req.user.displayName || req.user.username;
        newRecord.status = req.user.role === 'admin' ? 'approved' : 'pending'; // Admin'in ilanları direkt onaylı sayılır

        // Automatic Categorization
        const { mainCategory, subCategory } = categorizeListing(newRecord);
        newRecord.mainCategory = mainCategory;
        newRecord.subCategory = subCategory;

        const docRef = await addDoc(collection(db, DB_COLLECTION), newRecord);
        console.log("Document written with ID: ", docRef.id, " by ", req.user.username);

        await logActivity({
            listingId: docRef.id,
            listingTitle: newRecord.title || '',
            action: 'listing_added',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Record saved as pending', data: { id: docRef.id, ...newRecord } });
    } catch (err) {
        console.error("Error adding document: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/records/:id/approve - İlanı onaylama, not ve durum ekleme
app.put('/api/records/:id/approve', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { note, status_tag } = req.body;

    try {
        const docRef = doc(db, DB_COLLECTION, id);

        // Sadece yetkili hesap veya kendi eklediği ise güncelleyebilir
        if (req.user.role !== 'admin') {
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to approve this record' });
            }
        }

        const updateData = {
            status: 'approved',
            status_tag: status_tag || '',
            note: note || '',
            approvedAt: new Date().toISOString()
        };

        const docSnap2 = await getDoc(docRef);
        const prevData = docSnap2.exists() ? docSnap2.data() : {};
        await updateDoc(docRef, updateData);

        await logActivity({
            listingId: id,
            listingTitle: prevData.title || '',
            action: 'status_changed',
            from: prevData.status || '',
            to: 'approved',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Record approved successfully', data: updateData });
    } catch (err) {
        console.error("Error approving document: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/records/:id/update - Onaylanmış ilanın notunu ve durumunu güncelleme
app.put('/api/records/:id/update', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { note, status_tag } = req.body;

    try {
        const docRef = doc(db, DB_COLLECTION, id);

        if (req.user.role !== 'admin') {
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to update this record' });
            }
        }

        const prevSnap = await getDoc(docRef);
        const prevData = prevSnap.exists() ? prevSnap.data() : {};

        const updateData = {};
        if (note !== undefined) updateData.note = note;
        if (status_tag !== undefined) updateData.status_tag = status_tag;

        await updateDoc(docRef, updateData);

        if (note !== undefined && note !== prevData.note) {
            await logActivity({
                listingId: id,
                listingTitle: prevData.title || '',
                action: 'note_changed',
                from: prevData.note || '',
                to: note,
                by: req.user.displayName || req.user.username,
                byId: req.user.id
            });
        }
        if (status_tag !== undefined && status_tag !== prevData.status_tag) {
            await logActivity({
                listingId: id,
                listingTitle: prevData.title || '',
                action: 'status_tag_changed',
                from: prevData.status_tag || '',
                to: status_tag,
                by: req.user.displayName || req.user.username,
                byId: req.user.id
            });
        }

        res.json({ success: true, message: 'Record updated successfully', data: updateData });
    } catch (err) {
        console.error("Error updating document: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE a record (Soft Delete)
app.delete('/api/records/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (req.user.role !== 'admin') {
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to delete this record' });
            }
        }

        const listingData = docSnap.exists() ? docSnap.data() : {};

        await updateDoc(docRef, {
            status: 'deleted',
            previousStatus: listingData.status || (req.user.role === 'admin' ? 'approved' : 'pending'),
            deletedAt: new Date().toISOString()
        });

        await logActivity({
            listingId: id,
            listingTitle: listingData.title || '',
            action: 'soft_deleted',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Record moved to trash' });
    } catch (err) {
        console.error("Error soft deleting document: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/records/trash/empty - Çöp kutusunu tamamen boşalt
app.delete('/api/records/trash/empty', authenticateToken, async (req, res) => {
    try {
        let qTrash;
        if (req.user.role === 'admin') {
            qTrash = query(collection(db, DB_COLLECTION), where('status', '==', 'deleted'));
        } else {
            qTrash = query(collection(db, DB_COLLECTION), where('userId', '==', req.user.id), where('status', '==', 'deleted'));
        }

        const trashSnap = await getDocs(qTrash);

        if (trashSnap.empty) {
            return res.json({ success: true, message: 'Trash is already empty', count: 0 });
        }

        let count = 0;
        const deletePromises = trashSnap.docs.map(async d => {
            const data = d.data();
            await deleteDoc(d.ref);

            await logActivity({
                listingId: d.id,
                listingTitle: data.title || '',
                action: 'hard_deleted',
                by: req.user.displayName || req.user.username,
                byId: req.user.id
            });
            count++;
        });

        await Promise.all(deletePromises);

        res.json({ success: true, message: `Permanently deleted ${count} records from trash`, count });
    } catch (err) {
        console.error("Error emptying trash: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE a record permanently (Hard Delete)
app.delete('/api/records/:id/hard', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (req.user.role !== 'admin') {
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to hard delete this record' });
            }
        }

        const listingData = docSnap.exists() ? docSnap.data() : {};
        await deleteDoc(docRef);

        await logActivity({
            listingId: id,
            listingTitle: listingData.title || '',
            action: 'hard_deleted',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Record permanently deleted' });
    } catch (err) {
        console.error("Error hard deleting document: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/records/:id/restore - Silinen ilanı geri alma
app.put('/api/records/:id/restore', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (req.user.role !== 'admin') {
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to restore this record' });
            }
        }

        const listingData = docSnap.exists() ? docSnap.data() : {};
        const newStatus = listingData.previousStatus || (req.user.role === 'admin' ? 'approved' : 'pending');

        await updateDoc(docRef, {
            status: newStatus,
            previousStatus: deleteField(),
            deletedAt: deleteField() // Remove the deletedAt timestamp
        });

        await logActivity({
            listingId: id,
            listingTitle: listingData.title || '',
            action: 'restored',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Record restored successfully' });
    } catch (err) {
        console.error("Error restoring document: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/activity — all activity (admin: all users, others: own)
app.get('/api/activity', authenticateToken, async (req, res) => {
    try {
        const snap = await getDocs(collection(db, DB_ACTIVITY));
        let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter if not admin
        if (req.user.role !== 'admin') {
            logs = logs.filter(l => l.byId === req.user.id);
        }

        // Sort descending
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Limit
        logs = logs.slice(0, 200);

        res.json({ success: true, data: logs });
    } catch (err) {
        console.error("GET /api/activity Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ADMIN: Re-categorize all listings (One-time migration helper)
app.post('/api/admin/re-categorize', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin only' });
    }

    try {
        console.log("[ADMIN] Starting re-categorization...");
        const snap = await getDocs(collection(db, DB_COLLECTION));
        console.log(`[ADMIN] Found ${snap.docs.length} listings to process.`);

        let updateCount = 0;
        let errorCount = 0;
        const docs = snap.docs;
        const batchSize = 200; // Firestore limit is 500, we use 200 for safety

        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + batchSize);
            let chunkUpdateCount = 0;

            chunk.forEach((d) => {
                try {
                    const data = d.data();
                    const { mainCategory, subCategory } = categorizeListing(data);
                    if (data.mainCategory !== mainCategory || data.subCategory !== subCategory) {
                        batch.update(d.ref, { mainCategory, subCategory });
                        chunkUpdateCount++;
                    }
                } catch (e) {
                    console.error(`[ADMIN] Error processing doc ${d.id}:`, e.message);
                    errorCount++;
                }
            });

            if (chunkUpdateCount > 0) {
                await batch.commit();
                updateCount += chunkUpdateCount;
                console.log(`[ADMIN] Committed batch: ${updateCount} total updates so far.`);
            }
        }

        console.log(`[ADMIN] Re-categorization finished. Updated: ${updateCount}, Errors: ${errorCount}`);

        res.status(200).json({
            success: true,
            message: `Migration completed: ${updateCount} records updated.`
        });
    } catch (err) {
        console.error("[ADMIN] Re-categorize fatal error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/records/:id/activity — activity for a specific listing
app.get('/api/records/:id/activity', authenticateToken, async (req, res) => {
    try {
        const snap = await getDocs(collection(db, DB_ACTIVITY));
        let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter by listing
        logs = logs.filter(l => l.listingId === req.params.id);

        // Sort descending
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ success: true, data: logs });
    } catch (err) {
        console.error(`GET /api/records/${req.params.id}/activity Error:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// APPOINTMENTS (RANDEVULAR) ENDPOINTS
// ==========================================

// POST /api/appointments
app.post('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const appointmentData = req.body;
        appointmentData.createdAt = new Date().toISOString();
        appointmentData.userId = req.user.id;
        appointmentData.username = req.user.username;
        appointmentData.displayName = req.user.displayName || req.user.username;

        const docRef = await addDoc(collection(db, DB_APPOINTMENTS), appointmentData);

        await logActivity({
            listingId: docRef.id,
            listingTitle: `Randevu: ${appointmentData.customerName || 'İsimsiz'}`,
            action: 'appointment_added',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, data: { id: docRef.id, ...appointmentData } });
    } catch (err) {
        console.error("POST /api/appointments Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/appointments
app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const snap = await getDocs(collection(db, DB_APPOINTMENTS));
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (req.user.role !== 'admin') {
            items = items.filter(i => i.userId === req.user.id);
        }

        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ success: true, data: items });
    } catch (err) {
        console.error("GET /api/appointments Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/appointments/:id
app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const docRef = doc(db, DB_APPOINTMENTS, id);

        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const prevData = docSnap.data();
        await updateDoc(docRef, updateData);

        if (updateData.status && updateData.status !== prevData.status) {
            await logActivity({
                listingId: id,
                listingTitle: `Randevu: ${prevData.customerName || 'İsimsiz'}`,
                action: 'appointment_updated',
                from: prevData.status || '',
                to: updateData.status,
                by: req.user.displayName || req.user.username,
                byId: req.user.id
            });
        }
        if (updateData.note && updateData.note !== prevData.note) {
            await logActivity({
                listingId: id,
                listingTitle: `Randevu: ${prevData.customerName || 'İsimsiz'}`,
                action: 'note_changed',
                from: prevData.note || '',
                to: updateData.note,
                by: req.user.displayName || req.user.username,
                byId: req.user.id
            });
        }

        res.json({ success: true, data: { ...prevData, ...updateData } });
    } catch (err) {
        console.error("PUT /api/appointments Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/appointments/:id
app.delete('/api/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const docRef = doc(db, DB_APPOINTMENTS, id);

        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const prevData = docSnap.data();
        await deleteDoc(docRef);

        await logActivity({
            listingId: id,
            listingTitle: `Randevu: ${prevData.customerName || 'İsimsiz'}`,
            action: 'appointment_deleted',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/appointments Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// DEMANDS API
// ==========================================

// GET /api/demands
app.get('/api/demands', authenticateToken, async (req, res) => {
    try {
        const demandsRef = collection(db, DB_DEMANDS);
        const snap = await getDocs(demandsRef);
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Only admins see all demands, others see their own
        if (req.user.role !== 'admin') {
            items = items.filter(i => i.userId === req.user.id);
        }

        // Sort descending by creation date
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ success: true, data: items });
    } catch (err) {
        console.error("GET /api/demands Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/demands/:id
app.get('/api/demands/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const docRef = doc(db, DB_DEMANDS, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists() || (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Unauthorized or not found' });
        }

        res.json({ success: true, data: { id: docSnap.id, ...docSnap.data() } });
    } catch (err) {
        console.error("GET /api/demands/:id Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/demands
app.post('/api/demands', authenticateToken, async (req, res) => {
    try {
        const newDemand = {
            ...req.body,
            userId: req.user.id,
            status: 'Aktif',
            matchedListings: [],
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, DB_DEMANDS), newDemand);

        await logActivity({
            listingId: docRef.id,
            listingTitle: `Talep: ${newDemand.clientName} (${newDemand.demandType})`,
            action: 'demand_created',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, data: { id: docRef.id, ...newDemand } });
    } catch (err) {
        console.error("POST /api/demands Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/demands/:id
app.put('/api/demands/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const docRef = doc(db, DB_DEMANDS, id);

        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Unauthorized or not found' });
        }

        await updateDoc(docRef, updateData);
        res.json({ success: true, data: { ...docSnap.data(), ...updateData } });
    } catch (err) {
        console.error("PUT /api/demands Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/demands/:id
app.delete('/api/demands/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const docRef = doc(db, DB_DEMANDS, id);

        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Unauthorized or not found' });
        }

        const prevData = docSnap.data();
        await deleteDoc(docRef);

        await logActivity({
            listingId: id,
            listingTitle: `Talep İptali: ${prevData.clientName}`,
            action: 'demand_deleted',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Talep silindi' });
    } catch (err) {
        console.error("DELETE /api/demands Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/demands/:id/match - Add a listing to a demand
app.post('/api/demands/:id/match', authenticateToken, async (req, res) => {
    try {
        const demandId = req.params.id;
        const listingData = req.body.listing;

        if (!listingData || !listingData.id) {
            return res.status(400).json({ success: false, error: 'Geçersiz ilan verisi.' });
        }

        // 1. Get Demand
        const demandRef = doc(db, DB_DEMANDS, demandId);
        const demandSnap = await getDoc(demandRef);

        if (!demandSnap.exists() || (req.user.role !== 'admin' && demandSnap.data().userId !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Talep bulunamadı veya yetkisiz.' });
        }

        const demand = demandSnap.data();
        const matchedListings = demand.matchedListings || [];

        // Check if already matched
        if (matchedListings.find(l => l.listingId === listingData.id)) {
            return res.status(400).json({ success: false, error: 'Bu ilan bu talebe zaten eklenmiş.' });
        }

        // 2. Add minimal listing data to demand's matched array
        matchedListings.push({
            listingId: listingData.id,
            title: listingData.title,
            price: listingData.price,
            city: listingData.city,
            district: listingData.district,
            neighborhood: listingData.neighborhood,
            dateAdded: new Date().toISOString()
        });

        await updateDoc(demandRef, { matchedListings });

        // 3. Update the Listing's state in DB_COLLECTION to 'matched' so it leaves pending
        const listingRef = doc(db, DB_COLLECTION, listingData.id);
        const listingSnap = await getDoc(listingRef);

        if (listingSnap.exists()) {
            await updateDoc(listingRef, {
                status: 'matched',
                matchedDemandId: demandId,
                matchedDemandClient: demand.clientName
            });
        }

        // Log action
        await logActivity({
            listingId: listingData.id,
            listingTitle: listingData.title,
            action: 'matched_to_demand',
            from: 'pending',
            to: 'matched',
            by: req.user.displayName || req.user.username,
            byId: req.user.id,
            note: `Talep Eklendi: ${demand.clientName}`
        });

        res.json({ success: true, message: 'İlan başarıyla talebe eklendi.' });
    } catch (err) {
        console.error("POST /api/demands/match Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// EfdalAI: Analyze listing with Gemini
app.post('/api/ai/analyze/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    console.error(`!!! CRITICAL - AI REQUEST DETECTED !!! 
        Time: ${new Date().toISOString()}
        ID: ${id}
        User: ${req.user.username}
        Referer: ${req.headers.referer || 'No Referer'}
        User-Agent: ${req.headers['user-agent']}
    `);

    console.log(`[DEBUG] AI route started for ID: ${id}`);
    try {
        const docRef = doc(db, DB_COLLECTION, id);
        console.log(`[DEBUG] Fetching document from Firestore...`);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.warn(`[DEBUG] Document not found: ${id}`);
            return res.status(404).json({ success: false, error: 'Listing not found.' });
        }

        const data = docSnap.data();
        console.log(`[DEBUG] Document data loaded. Existing analysis? ${!!data.aiAnalysis}`);


        // If analysis already exists, return it
        if (data.aiAnalysis) {
            return res.json({ success: true, analysis: data.aiAnalysis });
        }

        const prompt = `
        Sen profesyonel bir emlak danışmanı olan "EfdalAI" yapay zeka asistanısın. 
        Görevin: Sahibinden (mülk sahibinden) girilen bir ilanı inceleyip, bu ilanı kendi portföyüne katmak isteyen bir "Emlak Danışmanı" gözüyle değerlendirmek.
        
        İlan Başlığı: ${data.title}
        Fiyat: ${data.price}
        Konum: ${data.location}
        Özellikler: ${JSON.stringify(data.properties)}
        Açıklama: ${data.description}
        
        Bu ilanı portföyüne alıp kısa sürede satma/kiralama potansiyelini analiz et ve sonucu PURE JSON formatında döndür:
        {
          "score": 0-100 arası Portföy Potansiyel Puanı (Danışman için bu ilanı almanın ve satmanın ne kadar karlı/mantıklı olduğu),
          "summary": "İlanın danışman perspektifinden kısa stratejik özeti",
          "pros": ["Danışman için avantaj 1", "Portföy kalitesi avantajı 2", ...],
          "cons": ["İlanı almadaki zorluklar", "Satış/Pazarlama riskleri", ...],
          "location_analysis": "Bölge hakimiyeti ve pazar talebi analizi",
          "price_analysis": "İlan fiyatının gerçek pazar değeriyle uyumu ve pazarlık payı öngörüsü",
          "investment_advice": "Danışmana tavsiye: Mülk sahibiyle nasıl iletişime geçilmeli? İlan portföye nasıl ikna edilmeli?"
        }

        JSON dışında hiçbir metin ekleme. Sadece geçerli bir JSON objesi döndür. Analiz dili Türkçe, profesyonel ve stratejik olmalı.
        `;

        let attempt = 0;
        let analysisJSON = null;
        const maxAttempts = 3;

        while (attempt < maxAttempts) {
            try {
                console.log(`[DEBUG] Gemini generateContent attempt ${attempt + 1}/${maxAttempts}...`);
                const result = await model.generateContent(prompt);
                console.log(`[DEBUG] Gemini response received. parsing...`);
                let text = result.response.text();

                // Markdown block temizleme (eğer varsa)
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();

                analysisJSON = JSON.parse(text);
                break;
            } catch (err) {
                console.error(`Attempt ${attempt + 1} failed:`, err.message);
                attempt++;
                if (err.status === 429 && attempt < maxAttempts) {
                    console.log(`Rate limit hit, retrying attempt ${attempt}...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                if (attempt >= maxAttempts) throw err;
            }
        }

        // Save analysis to Firestore as a stringified JSON (or object depending on preference)
        await updateDoc(docRef, { aiAnalysis: JSON.stringify(analysisJSON) });

        res.json({ success: true, analysis: analysisJSON });
    } catch (err) {
        console.error('Gemini Analysis Error Detail:', {
            message: err.message,
            status: err.status,
            name: err.name,
            stack: err.stack
        });

        if (err.status === 429) {
            return res.status(429).json({
                success: false,
                error: 'Gemini API Kotası Doldu (429).',
                details: 'Ücretsiz tier limitlerine takılmış olabilirsiniz. Lütfen 90 saniye bekleyin veya API anahtarınızı kontrol edin.'
            });
        }
        res.status(500).json({
            success: false,
            error: 'AI Analizi sırasında teknik bir sorun oluştu.',
            details: err.message
        });
    }
});

// EfdalAI: Analyze TKGM Parcel Data
app.post('/api/ai/analyze-parcel', authenticateToken, async (req, res) => {
    const { parcelData } = req.body;

    if (!parcelData) {
        return res.status(400).json({ success: false, error: 'Parcel data missing.' });
    }

    try {
        const prompt = `
        Sen "EfdalAI" adında uzman bir gayrimenkul ve imar danışmanısın.
        Aşağıda Tapu ve Kadastro Genel Müdürlüğünden alınmış resmi bir parsel verisi var.
        Bu parsel için detaylı bir gayrimenkul analizi yap.

        Parsel Verisi:
        ${JSON.stringify(parcelData, null, 2)}

        Şunları değerlendir:
        1. Parsele yapı (ev, bağ evi, depo vs.) yapılıp yapılamayacağı (Nitelik, Alan ve yasal mevzuat bağlamında tahmini).
        2. Toprağın tarımsal veya ticari potansiyeli.
        3. Parselin alanı göz önüne alındığında, eğer imara açıksa tahmini inşaat alanı kapasitesi.
        4. Bölgenin (İl/İlçe) genel yatırım potansiyeli ve riskler.
        `;

        const parcelSchema = {
            description: "Gayrimenkul parsel analiz raporu",
            type: SchemaType.OBJECT,
            properties: {
                buildableStatus: {
                    type: SchemaType.STRING,
                    description: "Yapılaşma İhtimali ve Yasal Tahmin Özeti (Kısa ve net)",
                },
                agriculturalValue: {
                    type: SchemaType.STRING,
                    description: "Tarımsal ve Zirai Verimlilik Özeti",
                },
                investmentPotential: {
                    type: SchemaType.STRING,
                    description: "Yatırım Değeri (0-10 Arası skor) ve Kısa Neden",
                },
                detailedAnalysis: {
                    type: SchemaType.STRING,
                    description: "Danışman gözünden detaylı ve kapsamlı paragraf raporu",
                },
                constraints: {
                    type: SchemaType.ARRAY,
                    description: "Olası yasal kısıtlamalar veya riskler listesi",
                    items: {
                        type: SchemaType.STRING,
                    },
                },
            },
            required: ["buildableStatus", "agriculturalValue", "investmentPotential", "detailedAnalysis", "constraints"],
        };

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: parcelSchema,
            }
        });

        let text = result.response.text();
        const analysisJSON = JSON.parse(text);

        // Log this AI action
        await logActivity({
            listingId: 'tkgm-query',
            listingTitle: `Parsel Analizi: ${parcelData.ilAd}/${parcelData.ilceAd}`,
            action: 'query',
            from: 'TKGM',
            to: 'AI_Analyzed',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, analysis: analysisJSON });

    } catch (err) {
        console.error('Gemini Parcel Analysis Error:', err.message);
        if (err.status === 429) {
            return res.status(429).json({ success: false, error: 'AI Kota sınırı aşıldı. Lütfen biraz bekleyin.' });
        }
        res.status(500).json({ success: false, error: 'AI analizi başarısız oldu.', details: err.message });
    }
});

// EfdalAI: Clear analysis to allow fresh start
app.post('/api/ai/clear/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const docRef = doc(db, DB_COLLECTION, id);
        await updateDoc(docRef, { aiAnalysis: null });
        res.json({ success: true, message: 'Analiz temizlendi.' });
    } catch (err) {
        console.error("Error clearing analysis:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// File Upload Endpoint
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Construct public URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
});

// Announcements: Create (Admin Only)
app.post('/api/announcements', authenticateToken, async (req, res) => {
    console.log(`[DEBUG] Received announcement request:`, req.body);
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admins can post announcements.' });
    }

    const { title, content, imageUrl, quotedListing, type } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required.' });
    }

    try {
        await addDoc(collection(db, DB_ANNOUNCEMENTS), {
            title,
            content,
            type: type || 'Duyuru',
            imageUrl: imageUrl || '',
            quotedListing: quotedListing || null,
            author: req.user.displayName || req.user.username,
            authorId: req.user.id,
            createdAt: new Date().toISOString()
        });
        res.json({ success: true, message: 'Announcement posted' });
    } catch (err) {
        console.error("Error adding announcement: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Announcements: Delete (Admin Only)
app.delete('/api/announcements/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admins can delete announcements.' });
    }
    try {
        await deleteDoc(doc(db, DB_ANNOUNCEMENTS, req.params.id));
        res.json({ success: true, message: 'Announcement deleted' });
    } catch (err) {
        console.error("Error deleting announcement:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Announcements: List
app.get('/api/announcements', authenticateToken, async (req, res) => {
    try {
        const q = query(collection(db, DB_ANNOUNCEMENTS), orderBy("createdAt", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        const announcements = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.json({ success: true, data: announcements });
    } catch (err) {
        console.error("Error fetching announcements: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// Export the Express API for Vercel Serverless Functions
module.exports = app;

// Only listen locally if not running on Vercel
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server API running on http://localhost:${PORT}`);
        console.log('Connected to Firebase Firestore.');
    });
}
