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
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

const PORT = process.env.PORT || 3001;
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
const DB_ARCHIVE_FOLDERS = "archive_folders";
const DB_COLLECTIONS = "collections";
const DB_MESSAGES = "messages";
const DB_TRADES = "trades";
const DB_TRADE_REQUESTS = "trade_requests";
const DB_EXCEL_LISTS = "excel_lists";

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

        // 1. Check if specific "admin" username exists
        const qAdmin = query(usersRef, where("username", "==", "admin"), limit(1));
        const adminSnapshot = await getDocs(qAdmin);

        if (adminSnapshot.empty) {
            console.log("[SYSTEM] No 'admin' user found. Creating default admin/admin...");
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
            console.log("[SYSTEM] Default admin created successfully.");
        } else {
            // 2. Proactively clean up ANY other "Sistem Yöneticisi" duplicates that aren't the primary one
            const primaryAdminId = adminSnapshot.docs[0].id;
            const qAllAdmins = query(usersRef, where("role", "==", "admin"));
            const allAdminsSnapshot = await getDocs(qAllAdmins);

            if (allAdminsSnapshot.size > 1) {
                console.log(`[SYSTEM] Found ${allAdminsSnapshot.size - 1} duplicate admin accounts. Cleaning up...`);
                let deletedCount = 0;
                for (const d of allAdminsSnapshot.docs) {
                    // Delete if it's an admin role but NOT our primary "admin" username doc
                    if (d.id !== primaryAdminId) {
                        await deleteDoc(doc(db, DB_USERS, d.id));
                        deletedCount++;
                    }
                }
                if (deletedCount > 0) console.log(`[SYSTEM] Successfully cleaned up ${deletedCount} duplicate admin accounts.`);
            }
        }
    } catch (err) {
        console.error("[SYSTEM] Error initializing/cleaning admin users:", err);
    }
}
initializeAdminUser();

// JWT Middleware
// JWT Middleware
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.log(`[AUTH] No token for ${req.method} ${req.url}`);
            return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
        }

        jwt.verify(token, JWT_SECRET, async (err, user) => {
            if (err) {
                console.log(`[AUTH] Invalid token for ${req.method} ${req.url}: ${err.message}`);
                return res.status(403).json({ success: false, error: 'Invalid token.' });
            }

            if (!user || !user.id) {
                console.log(`[AUTH] Token payload missing user ID`);
                return res.status(403).json({ success: false, error: 'Invalid token payload.' });
            }

            try {
                const userDoc = await getDoc(doc(db, DB_USERS, user.id));
                if (!userDoc.exists()) {
                    console.log(`[AUTH] User ${user.id} not found in DB`);
                    return res.status(401).json({ success: false, error: 'USER_DELETED' });
                }
            } catch (dbErr) {
                console.warn(`[AUTH] DB check error for user ${user.id}: ${dbErr.message}`);
            }

            req.user = user;
            console.log(`[REQUEST][SID:${SESSION_ID}] ${new Date().toISOString()} - ${req.method} ${req.url} (User: ${user.username})`);
            next();
        });
    } catch (globalAuthErr) {
        console.error(`[AUTH] GLOBAL ERROR:`, globalAuthErr);
        res.status(500).json({ success: false, error: 'Auth Middleware Error' });
    }
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
        if (req.user.role === 'admin') {
            // Fetch all for admin, sort in-memory to avoid index requirement
            q = query(collection(db, DB_COLLECTION));
        } else {
            // For users, fetch only their own
            q = query(collection(db, DB_COLLECTION), where("userId", "==", req.user.id));
        }

        const querySnapshot = await getDocs(q);

        let records = querySnapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));

        // Sort in-memory to avoid index requirement during development
        records.sort((a, b) => {
            const dateA = new Date(a.approvedAt || a.scrapedAt);
            const dateB = new Date(b.approvedAt || b.scrapedAt);
            return dateB - dateA;
        });

        const tradeCount = records.filter(r => r.isTrade === true || r.isTrade === 'true').length;
        console.log(`[GET RECORDS] Returned ${records.length} records. Trade records: ${tradeCount} for user ${req.user.username}`);

        res.json({ success: true, data: records });
    } catch (err) {
        console.error("Error fetching documents: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST save a new record
app.post('/api/save', authenticateToken, async (req, res) => {
    const newRecord = req.body;

    if (!newRecord || !newRecord.title) {
        return res.status(400).json({ success: false, error: 'Invalid data: Title is required' });
    }

    // Handle manual entries (no URL provided)
    if (!newRecord.url) {
        newRecord.url = `manual://${Date.now()}-${Math.random().toString(36).substring(7)}`;
        newRecord.isManual = true;
    }

    try {
        console.log(`[SAVE] Incoming request for URL: ${newRecord.url} by ${req.user.username}`);

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

        // Enforce timestamp and attribution
        newRecord.scrapedAt = newRecord.scrapedAt ? new Date(newRecord.scrapedAt).toISOString() : new Date().toISOString();
        newRecord.userId = req.user.id;
        newRecord.username = req.user.username;
        newRecord.displayName = req.user.displayName || req.user.username;
        newRecord.status = req.user.role === 'admin' ? 'approved' : 'pending';
        if (newRecord.status === 'approved') {
            newRecord.approvedAt = new Date().toISOString();
        }

        // Automatic Categorization (only if not provided or for legacy support)
        if (!newRecord.mainCategory || !newRecord.subCategory || newRecord.mainCategory === 'Diğer') {
            const { mainCategory, subCategory } = categorizeListing(newRecord);
            if (!newRecord.mainCategory || newRecord.mainCategory === 'Diğer') newRecord.mainCategory = mainCategory;
            if (!newRecord.subCategory || newRecord.subCategory === 'Diğer') newRecord.subCategory = subCategory;
        }

        // Ensure defaults
        if (!newRecord.officeName) newRecord.officeName = '';
        if (!newRecord.officeLogo) newRecord.officeLogo = '';
        if (newRecord.isOffice === undefined) newRecord.isOffice = false;
        if (newRecord.isTrade === undefined) newRecord.isTrade = false;

        let shouldForceSave = newRecord.forceSave;
        let shouldOverwrite = newRecord.overwrite;
        delete newRecord.forceSave;
        delete newRecord.overwrite;

        // If forced and requested to overwrite, update the old duplicate instead of creating a new one
        if (shouldForceSave && shouldOverwrite && !duplicatesSnap.empty) {
            // Find the primary document to update
            const sortedDocs = duplicatesSnap.docs.sort((a, b) => new Date(b.data().scrapedAt).getTime() - new Date(a.data().scrapedAt).getTime());
            const activeDocs = sortedDocs.filter(d => d.data().status !== 'deleted');
            const primaryDoc = activeDocs.length > 0 ? activeDocs[0] : sortedDocs[0];
            const primaryData = primaryDoc.data();

            // Inherit specific fields
            if (primaryData.note) newRecord.note = primaryData.note;
            if (primaryData.status_tag) newRecord.status_tag = primaryData.status_tag;
            if (primaryData.aiAnalysis) newRecord.aiAnalysis = primaryData.aiAnalysis;
            if (!newRecord.officeName && primaryData.officeName) newRecord.officeName = primaryData.officeName;
            if (newRecord.isOffice === undefined && primaryData.isOffice !== undefined) newRecord.isOffice = primaryData.isOffice;

            // Delete OTHER duplicates to enforce uniqueness if there happens to be multiple
            const deletePromises = [];
            sortedDocs.forEach(d => {
                if (d.id !== primaryDoc.id && d.data().status !== 'deleted') {
                    deletePromises.push(updateDoc(d.ref, {
                        status: 'deleted',
                        previousStatus: d.data().status || (req.user.role === 'admin' ? 'approved' : 'pending'),
                        deletedAt: new Date().toISOString()
                    }));
                }
            });
            await Promise.all(deletePromises);

            await updateDoc(primaryDoc.ref, newRecord);
            console.log(`[SAVE] Overwrote duplicate entry for ${newRecord.url} on document ${primaryDoc.id}`);

            await logActivity({
                listingId: primaryDoc.id,
                listingTitle: newRecord.title || '',
                action: 'listing_updated',
                by: req.user.displayName || req.user.username,
                byId: req.user.id
            });

            return res.json({ success: true, message: 'Record updated successfully', data: { id: primaryDoc.id, ...newRecord } });
        }

        const docRef = await addDoc(collection(db, DB_COLLECTION), newRecord);
        console.log(`[SAVE SUCCESS] Document written with ID: ${docRef.id} by ${req.user.username}. isTrade: ${newRecord.isTrade}`);

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

        const activeStatuses = ['Arandı', 'Ulaşılamadı', 'Düşünülecek'];
        if (status_tag !== undefined) {
            const isNowActive = activeStatuses.includes(status_tag);
            const wasActive = activeStatuses.includes(prevData.status_tag);

            if (isNowActive && !wasActive) {
                updateData.arandiAt = new Date().toISOString();
            } else if (!isNowActive && wasActive) {
                updateData.arandiAt = deleteField();
            }
        }

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

        const activeStatuses = ['Arandı', 'Ulaşılamadı', 'Düşünülecek'];
        if (status_tag !== undefined && status_tag !== prevData.status_tag) {
            const isNowActive = activeStatuses.includes(status_tag);
            const wasActive = activeStatuses.includes(prevData.status_tag);

            if (isNowActive && !wasActive) {
                updateData.arandiAt = new Date().toISOString();
            } else if (!isNowActive && wasActive) {
                updateData.arandiAt = deleteField();
            }
        }

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

// PUT /api/records/:id/portfolio - İlanı portföye ekleme/çıkarma
app.put('/api/records/:id/portfolio', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { isPortfolio } = req.body;

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Kayıt bulunamadı' });
        }

        if (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Yetkiniz yok' });
        }

        await updateDoc(docRef, { isPortfolio: !!isPortfolio });

        // Activity log
        await logActivity({
            listingId: docSnap.id,
            listingTitle: docSnap.data().title || 'Bilinmeyen İlan',
            action: isPortfolio ? 'added_to_portfolio' : 'removed_from_portfolio',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: isPortfolio ? 'Portföye eklendi' : 'Portföyden çıkarıldı', isPortfolio: !!isPortfolio });
    } catch (err) {
        console.error("Error updating portfolio status: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/records/:id/archive - İlanı arşivleme
app.put('/api/records/:id/archive', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { folderId } = req.body || {};

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (req.user.role !== 'admin') {
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to archive this record' });
            }
        }

        const listingData = docSnap.exists() ? docSnap.data() : {};

        const updateData = {
            status: 'archived',
            archivedAt: new Date().toISOString()
        };

        if (folderId) {
            updateData.archiveFolderId = folderId;
        }

        await updateDoc(docRef, updateData);

        await logActivity({
            listingId: id,
            listingTitle: listingData.title || '',
            action: 'archived',
            from: listingData.status || 'approved',
            to: 'archived',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Record archived successfully' });
    } catch (err) {
        console.error("Error archiving document: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/records/:id/move-folder - Arşiv klasörünü değiştir
app.put('/api/records/:id/move-folder', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { folderId } = req.body;

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (req.user.role !== 'admin') {
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to move this record' });
            }
        }

        const updateData = {};
        if (folderId) {
            updateData.archiveFolderId = folderId;
        } else {
            updateData.archiveFolderId = deleteField();
        }

        await updateDoc(docRef, updateData);
        res.json({ success: true, message: 'Record moved to folder successfully' });
    } catch (err) {
        console.error("Error moving document to folder: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/archive-folders - Arşiv klasörlerini getir
app.get('/api/archive-folders', authenticateToken, async (req, res) => {
    try {
        let q;
        if (req.user.role === 'admin') {
            q = query(collection(db, DB_ARCHIVE_FOLDERS));
        } else {
            // Because Firestore requires a composite index for equality on userId and ordering by createdAt
            // we will fetch by userId and sort in-memory to avoid index creation hassles for the user
            q = query(collection(db, DB_ARCHIVE_FOLDERS), where('userId', '==', req.user.id));
        }

        const querySnapshot = await getDocs(q);
        const folders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort by createdAt ascending in-memory
        folders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        res.json({ success: true, data: folders });
    } catch (err) {
        console.error("Error fetching archive folders: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/archive-folders - Yeni arşiv klasörü ekle
app.post('/api/archive-folders', authenticateToken, async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    try {
        const docRef = await addDoc(collection(db, DB_ARCHIVE_FOLDERS), {
            name: name.trim(),
            userId: req.user.id,
            username: req.user.username,
            displayName: req.user.displayName || req.user.username,
            createdAt: new Date().toISOString()
        });
        res.json({ success: true, message: 'Folder created successfully', data: { id: docRef.id, name: name.trim() } });
    } catch (err) {
        console.error("Error creating archive folder: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/archive-folders/:id - Arşiv klasörü sil
app.delete('/api/archive-folders/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const docRef = doc(db, DB_ARCHIVE_FOLDERS, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Folder not found' });
        }

        if (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized to delete this folder' });
        }

        await deleteDoc(docRef);

        // Klasörü silince içindeki ilanların klasör id'sini temizleyebiliriz
        const recordsQuery = query(collection(db, DB_COLLECTION), where('archiveFolderId', '==', id));
        const recordsSnapshot = await getDocs(recordsQuery);

        if (!recordsSnapshot.empty) {
            const batch = writeBatch(db);
            recordsSnapshot.docs.forEach(docSnap => {
                batch.update(docSnap.ref, { archiveFolderId: deleteField() });
            });
            await batch.commit();
        }

        res.json({ success: true, message: 'Folder deleted successfully' });
    } catch (err) {
        console.error("Error deleting archive folder: ", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/records/:id/unarchive - İlanı arşivden çıkarma
app.put('/api/records/:id/unarchive', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (req.user.role !== 'admin') {
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to unarchive this record' });
            }
        }

        const listingData = docSnap.exists() ? docSnap.data() : {};

        await updateDoc(docRef, {
            status: 'approved',
            unarchivedAt: new Date().toISOString(),
            approvedAt: new Date().toISOString()
        });

        await logActivity({
            listingId: id,
            listingTitle: listingData.title || '',
            action: 'unarchived',
            from: listingData.status || 'archived',
            to: 'approved',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Record unarchived successfully' });
    } catch (err) {
        console.error("Error unarchiving document: ", err);
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

        // Filter: Own demands, Public demands, or Direct shares to current user
        if (req.user.role !== 'admin') {
            items = items.filter(i =>
                i.userId === req.user.id ||
                i.shareType === 'public' ||
                (i.shareType === 'direct' && i.sharedWithIds?.includes(req.user.id))
            );
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

        if (!docSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Talep bulunamadı' });
        }

        const demand = docSnap.data();
        const isOwner = demand.userId === req.user.id;
        const isPublic = demand.shareType === 'public';
        const isDirectlyShared = demand.shareType === 'direct' && demand.sharedWithIds?.includes(req.user.id);

        if (req.user.role !== 'admin' && !isOwner && !isPublic && !isDirectlyShared) {
            return res.status(403).json({ success: false, error: 'Yetkisiz erişim' });
        }

        res.json({ success: true, data: { id: docSnap.id, ...demand } });
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

// POST /api/demands/:id/share - Share a demand with others
app.post('/api/demands/:id/share', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { shareType, sharedWithIds } = req.body; // shareType: 'public', 'direct', 'private'

        const docRef = doc(db, DB_DEMANDS, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists() || (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Yetkisiz işlem' });
        }

        await updateDoc(docRef, {
            shareType: shareType || 'private',
            sharedWithIds: sharedWithIds || [],
            sharedAt: new Date().toISOString()
        });

        await logActivity({
            listingId: id,
            listingTitle: `Talep Paylaşımı (${shareType}): ${docSnap.data().clientName}`,
            action: 'demand_shared',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, message: 'Talep başarıyla paylaşıldı' });
    } catch (err) {
        console.error("POST /api/demands/:id/share Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/feed - Get announcements of shared demands
app.get('/api/feed', authenticateToken, async (req, res) => {
    try {
        const snap = await getDocs(collection(db, DB_DEMANDS));
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter: Public demands OR direct shares to current user (excluding own demands for feed)
        items = items.filter(i =>
            i.userId !== req.user.id &&
            (i.shareType === 'public' || (i.shareType === 'direct' && i.sharedWithIds?.includes(req.user.id)))
        );

        // Sort by sharedAt or createdAt
        items.sort((a, b) => new Date(b.sharedAt || b.createdAt) - new Date(a.sharedAt || a.createdAt));

        res.json({ success: true, data: items });
    } catch (err) {
        console.error("GET /api/feed Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/messages - Send an in-app message regarding a demand
app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { demandId, receiverId, text, receiverName, demandTitle, listingId, listingTitle, listingUrl } = req.body;
        // Message logged only on error from here on
        if (!demandId || !receiverId || !text) {
            return res.status(400).json({ success: false, error: 'Eksik bilgi: Talep ID, alıcı ve mesaj zorunludur.' });
        }

        const newMessage = {
            demandId,
            demandTitle: demandTitle || 'Bir Talep',
            senderId: req.user.id,
            senderName: req.user.displayName || req.user.username,
            receiverId,
            receiverName: receiverName || 'Danışman',
            listingId: listingId || null,
            listingTitle: listingTitle || null,
            listingUrl: listingUrl || null,
            text,
            createdAt: new Date().toISOString(),
            read: false
        };

        const docRef = await addDoc(collection(db, DB_MESSAGES), newMessage);

        res.json({ success: true, message: 'Mesaj gönderildi', data: { id: docRef.id, ...newMessage } });
    } catch (err) {
        console.error("POST /api/messages Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/messages/conversations - Get list of all conversations for current user
app.get('/api/messages/conversations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const snap = await getDocs(collection(db, DB_MESSAGES));
        let allMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter and sort by date DESC
        allMessages = allMessages.filter(m => m.senderId === userId || m.receiverId === userId);
        allMessages.sort((a, b) => (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));

        const conversationsMap = new Map();

        allMessages.forEach(m => {
            const senderId = m.senderId;
            const receiverId = m.receiverId;
            const demandId = m.demandId;

            if (demandId && (senderId === userId || receiverId === userId)) {
                const otherPartyId = senderId === userId ? receiverId : senderId;
                if (!otherPartyId) return;

                const otherPartyName = senderId === userId ? (m.receiverName || 'Danışman') : (m.senderName || 'Danışman');
                const key = `${otherPartyId}_${demandId}`;

                if (!conversationsMap.has(key)) {
                    conversationsMap.set(key, {
                        otherUserId: otherPartyId,
                        otherUserName: otherPartyName,
                        demandId: m.demandId,
                        demandTitle: m.demandTitle || 'Bir Talep',
                        listingId: m.listingId || null,
                        listingTitle: m.listingTitle || null,
                        lastMessage: m.text,
                        lastMessageAt: m.createdAt,
                        lastMessageTime: m.createdAt,
                        unreadCount: (m.receiverId === userId && !m.read) ? 1 : 0
                    });
                } else {
                    const conv = conversationsMap.get(key);
                    if (m.receiverId === userId && !m.read) {
                        conv.unreadCount++;
                    }
                    if (!conv.listingId && m.listingId) {
                        conv.listingId = m.listingId;
                        conv.listingTitle = m.listingTitle;
                    }
                }
            }
        });

        res.json({ success: true, data: Array.from(conversationsMap.values()) });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/messages/:demandId - Get conversation for a specific demand
app.get('/api/messages/:demandId', authenticateToken, async (req, res) => {
    try {
        const { demandId } = req.params;
        const { otherUserId } = req.query;
        const snap = await getDocs(collection(db, DB_MESSAGES));

        let messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter by demandId in-memory to avoid index requirement
        messages = messages.filter(m => m.demandId === demandId);

        // Sort in-memory to avoid index issues
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Filter: Current user must be involved
        messages = messages.filter(m => m.senderId === req.user.id || m.receiverId === req.user.id);

        // If otherUserId is provided, strictly filter for that conversation
        if (otherUserId) {
            messages = messages.filter(m => m.senderId === otherUserId || m.receiverId === otherUserId);
        }

        // Mark messages as read for this user (async, don't block response)
        snap.docs.forEach(async (d) => {
            const m = d.data();
            if (m.receiverId === req.user.id && !m.read) {
                // Also check otherUserId if provided
                if (!otherUserId || m.senderId === otherUserId) {
                    updateDoc(doc(db, DB_MESSAGES, d.id), { read: true }).catch(e => console.error("Mark as read error:", e));
                }
            }
        });

        res.json({ success: true, data: messages });
    } catch (err) {
        console.error("GET /api/messages/:demandId Error:", err);
        console.error(err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/ping', (req, res) => {
    res.json({ success: true, message: 'pong', time: new Date().toISOString() });
});

// GET /api/debug - Simple endpoint to check if server is reachable
app.get('/api/debug', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user, sessionId: SESSION_ID });
});

// GET /api/users - Get list of users for sharing (publicly available to authenticated users)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const snap = await getDocs(collection(db, DB_USERS));
        const users = snap.docs.map(doc => {
            const d = doc.data();
            const color = d.color || d.userColor || '#3b82f6';
            return {
                id: doc.id,
                username: d.username,
                displayName: d.displayName,
                color: color,
                userColor: color // Keep for backward compatibility if any
            };
        });
        res.json({ success: true, data: users });
    } catch (err) {
        console.error("GET /api/users Error:", err);
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

// GET /api/demands/:id/colleague-matches - Get matches from other advisors
app.get('/api/demands/:id/colleague-matches', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const demandRef = doc(db, DB_DEMANDS, id);
        const demandSnap = await getDoc(demandRef);

        if (!demandSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
        }

        const demand = demandSnap.data();
        // Check if shared or owner
        const isOwner = demand.userId === req.user.id;
        const isPublic = demand.shareType === 'public';
        const isDirect = demand.shareType === 'direct' && demand.sharedWithIds?.includes(req.user.id);

        if (req.user.role !== 'admin' && !isOwner && !isPublic && !isDirect) {
            return res.status(403).json({ success: false, error: 'Yetkisiz erişim.' });
        }

        const matchedIds = (demand.matchedListings || []).map(l => l.listingId);

        // Fetch all active records belonging to OTHER users
        const recordsRef = collection(db, DB_COLLECTION);
        const recordsSnap = await getDocs(recordsRef);

        const matches = [];

        recordsSnap.forEach(docSnap => {
            const record = { id: docSnap.id, ...docSnap.data() };

            // Filter: Active, not already matched, belongs to a COLLEAGUE (other advisor)
            if (record.status !== 'approved' || matchedIds.includes(record.id) || !record.userId || record.userId === demand.userId) return;

            // Matching Logic (Simplistic but effective version of suggestions logic)
            // usually you'd want at least transactionType and category to match
            const recTransaction = record.mainCategory || '';
            const recType = record.subCategory || '';

            if (demand.transactionType && !recTransaction.includes(demand.transactionType)) return;
            if (demand.demandType && recType && !recType.includes(demand.demandType) && !demand.demandType.includes(recType)) return;

            // Location check
            const recLocation = String(record.location || '').toLowerCase();
            const demandNeighborhoods = (demand.details?.selectedNeighborhoods || []).map(n => n.toLowerCase());

            let locationMatch = false;
            if (demandNeighborhoods.length === 0) locationMatch = true; // No filter = all match
            else {
                locationMatch = demandNeighborhoods.some(n => recLocation.includes(n));
            }

            if (!locationMatch) return;

            // Price check (+/- 300k margin)
            let recPrice = parseInt(String(record.price || '').replace(/[^0-9]/g, ''), 10) || 0;
            let demandMaxPrice = parseInt(demand.details?.maxPrice, 10) || 0;
            if (demandMaxPrice > 0 && recPrice > 0) {
                const margin = demand.transactionType === 'Satılık' ? 300000 : demandMaxPrice * 0.2;
                if (recPrice > demandMaxPrice + margin || recPrice < demandMaxPrice - margin) return;
            }

            matches.push(record);
        });

        // Limit matches for performance
        res.json({ success: true, data: matches.slice(0, 50) });
    } catch (err) {
        console.error("GET /api/demands/:id/colleague-matches Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/demands/:id/suggestions - Get AI suggestions for a demand
app.get('/api/demands/:id/suggestions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const demandRef = doc(db, DB_DEMANDS, id);
        const demandSnap = await getDoc(demandRef);

        if (!demandSnap.exists() || (req.user.role !== 'admin' && demandSnap.data().userId !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Talep bulunamadı veya yetkisiz.' });
        }

        const demand = demandSnap.data();
        const matchedIds = (demand.matchedListings || []).map(l => l.listingId);

        // Fetch all active records (excluding deleted if possible, but Firestore '!=' requires an index, 
        // so we'll fetch all and filter in memory to avoid index creation issues right now)
        const recordsRef = collection(db, DB_COLLECTION);
        const recordsSnap = await getDocs(recordsRef);

        const suggestions = [];

        recordsSnap.forEach(docSnap => {
            const record = { id: docSnap.id, ...docSnap.data() };

            // Skip deleted and already matched listings
            if (record.status === 'deleted' || matchedIds.includes(record.id)) return;

            let score = 0;
            let matchDetails = [];

            // 1. Base Criteria: Transaction Type (Satılık/Kiralık) and Category (Konut/Arsa/Ticari)
            const recTransaction = record.mainCategory || ''; // usually Satılık/Kiralık
            const recType = record.subCategory || ''; // usually Konut/Arsa/Ticari/vb.

            if (demand.transactionType && !recTransaction.includes(demand.transactionType)) {
                return; // Must match transaction type completely
            }

            if (demand.demandType && recType) {
                if (recType.includes(demand.demandType) || demand.demandType.includes(recType)) {
                    score += 10; // Base score for category match
                    matchDetails.push({ text: 'Kategori Uygun', pts: 10 });
                } else {
                    return; // e.g. looking for Arsa, but record is Konut
                }
            } else {
                score += 5; // Base score if category is unclear but transaction type matched
            }

            // 2. Price Scoring (Max 30 pts)
            let recPriceStr = String(record.price || '').replace(/[^0-9]/g, '');
            let recPrice = parseInt(recPriceStr, 10) || 0;
            let demandMaxPrice = parseInt(demand.details?.maxPrice, 10) || 0;

            if (demandMaxPrice > 0 && recPrice > 0) {
                // Determine acceptable margin (user specifically requested +/- 300k for sales)
                let margin = demandMaxPrice * 0.15; // Default 15% for rentals or unknown
                if (demand.transactionType === 'Satılık' || demandMaxPrice > 500000) {
                    margin = 300000; // Fixed +/- 300,000 TL for sales/high value
                }

                const minAcceptablePrice = demandMaxPrice - margin;
                const maxAcceptablePrice = demandMaxPrice + margin;

                if (recPrice < minAcceptablePrice || recPrice > maxAcceptablePrice) {
                    return; // Outside the strict margin, completely ignore
                }

                if (recPrice <= demandMaxPrice) {
                    score += 30;
                    matchDetails.push({ text: 'Fiyat Uygun', pts: 30 });
                } else {
                    score += 10; // It's above max budget but within +300k
                    matchDetails.push({ text: 'Bütçeye Yakın', pts: 10 });
                }
            }

            // 3. Location Scoring (Max 40 pts)
            // Demand locations: [{city: "İstanbul", district: "Kadıköy", neighborhoods: ["Kozyatağı Mah", ...]}, ...]
            // Record location string: "İstanbul / Kadıköy / Kozyatağı"
            const recLocation = String(record.location || '').toLowerCase();
            let locationMatched = false;

            if (demand.locations && demand.locations.length > 0) {
                for (const loc of demand.locations) {
                    const c = (loc.city || '').toLowerCase();
                    const d = (loc.district || '').toLowerCase();

                    if (recLocation.includes(c) && recLocation.includes(d)) {
                        // District match at least
                        if (loc.neighborhoods && loc.neighborhoods.length > 0) {
                            // Check neighborhoods
                            const hasMahalleMatch = loc.neighborhoods.some(n => {
                                const cleanN = n.toLowerCase().replace(' mah.', '').replace(' mah', '').trim();
                                return recLocation.includes(cleanN);
                            });

                            if (hasMahalleMatch) {
                                score += 40;
                                matchDetails.push({ text: 'Tam Konum Eşleşmesi (Mahalle)', pts: 40 });
                                locationMatched = true;
                                break;
                            } else {
                                score += 20; // Only district matched, neighborhood didn't
                                matchDetails.push({ text: 'İlçe Eşleşmesi', pts: 20 });
                                locationMatched = true;
                                break;
                            }
                        } else {
                            // No neighborhood specified in demand, so district match is perfect
                            score += 40;
                            matchDetails.push({ text: 'Konum Eşleşmesi (İlçe)', pts: 40 });
                            locationMatched = true;
                            break;
                        }
                    }
                }

                // If demand has locations but this record matches NONE of them, filter it out.
                if (!locationMatched) return;
            }

            // 4. Room Matching (Strict Filtering + 20 pts)
            const demandRooms = String(demand.details?.rooms || '').trim().toLowerCase();
            const recRooms = String(record.properties?.['Oda Sayısı'] || '').trim().toLowerCase();

            if (demandRooms) {
                // If a room count is specified, and the record has a room count, enforce EXACT match.
                if (recRooms) {
                    if (demandRooms !== recRooms) {
                        return; // strict exact match required
                    } else {
                        score += 20;
                        matchDetails.push({ text: 'Oda Sayısı Tam Eşleşme', pts: 20 });
                    }
                } else {
                    // Record missing room count, penalize but keep maybe? Or filter?
                    // User asked for STRICKTER filtering. We'll filter out if missing and looking for Konut.
                    if (demand.demandType === 'Konut') return;
                }
            }

            // 5. Square Meters matching for Ticari/Arsa (Floor constraint)
            const demandM2 = parseInt(demand.details?.squareMeters, 10) || 0;
            // Emlakjet/Sahibinden properties usually have 'Metrekare (Brüt)' or 'Metrekare'
            const recM2Str = String(record.properties?.['Metrekare (Brüt)'] || record.properties?.['Metrekare'] || '').replace(/[^0-9]/g, '');
            const recM2 = parseInt(recM2Str, 10) || 0;

            if (demandM2 > 0) {
                if (recM2 > 0) {
                    if (recM2 < demandM2) {
                        return; // strictly smaller than requested minimum, filter out
                    } else {
                        score += 15;
                        matchDetails.push({ text: 'm² Uygun', pts: 15 });
                    }
                } else {
                    if (demand.demandType === 'Ticari' || demand.demandType === 'Arsa') return; // Filter out if m2 is missing for commercial/land
                }
            }

            // Suggest items with a score > 0
            if (score > 0) {
                suggestions.push({
                    listingId: record.id,
                    title: record.title,
                    price: record.price,
                    location: record.location,
                    images: record.images || [],
                    mainCategory: record.mainCategory,
                    subCategory: record.subCategory,
                    status_tag: record.status_tag,
                    status: record.status, // pending, approved, archived
                    sellerName: record.sellerName,
                    officeName: record.officeName,
                    officeLogo: record.officeLogo,
                    isOffice: record.isOffice,
                    ilanNo: record.properties?.['İlan No'] || '',
                    score: score,
                    matchDetails: matchDetails
                });
            }
        });

        // Sort by score descending
        suggestions.sort((a, b) => b.score - a.score);

        // Return top 15 suggestions
        res.json({ success: true, data: suggestions.slice(0, 15) });

    } catch (err) {
        console.error("GET /api/demands/:id/suggestions Error:", err);
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
            dateAdded: new Date().toISOString(),
            sellerName: listingData.sellerName || '',
            sellerPhone: listingData.sellerPhone || '',
            ilanNo: listingData.properties?.['İlan No'] || ''
        });

        await updateDoc(demandRef, { matchedListings });

        // 3. Update the Listing's state in DB_COLLECTION to 'matched' so it leaves pending
        const listingRef = doc(db, DB_COLLECTION, listingData.id);
        const listingSnap = await getDoc(listingRef);

        if (listingSnap.exists()) {
            await updateDoc(listingRef, {
                status: 'matched',
                matchedDemandId: demandId,
                matchedDemandClient: demand.clientName,
                approvedAt: new Date().toISOString()
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

// DELETE /api/demands/:demandId/match/:listingId
app.delete('/api/demands/:demandId/match/:listingId', authenticateToken, async (req, res) => {
    try {
        const { demandId, listingId } = req.params;

        const demandRef = doc(db, DB_DEMANDS, demandId);
        const demandSnap = await getDoc(demandRef);

        if (!demandSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
        }

        const demand = demandSnap.data();
        const matchedListings = demand.matchedListings || [];

        // Remove from matched array
        const updatedListings = matchedListings.filter(l => l.listingId !== listingId);

        await updateDoc(demandRef, { matchedListings: updatedListings });

        // Update listing status back to approved if it exists
        const listingRef = doc(db, DB_COLLECTION, listingId);
        const listingSnap = await getDoc(listingRef);

        if (listingSnap.exists()) {
            await updateDoc(listingRef, {
                status: 'approved',
                matchedDemandId: deleteField(),
                matchedDemandClient: deleteField()
            });

            // Log action
            await logActivity({
                listingId: listingId,
                listingTitle: listingSnap.data().title || 'Bilinmeyen İlan',
                action: 'unmatched_from_demand',
                from: 'matched',
                to: 'approved',
                by: req.user.displayName || req.user.username,
                byId: req.user.id,
                note: `Talepten Çıkarıldı: ${demand.clientName}`
            });
        }

        res.json({ success: true, message: 'İlan başarıyla talepten çıkarıldı.' });
    } catch (err) {
        console.error("DELETE /api/demands/match Error:", err);
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

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
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

// ==========================================
// COLLECTIONS API
// ==========================================

// GET /api/collections
app.get('/api/collections', authenticateToken, async (req, res) => {
    try {
        let q;
        if (req.user.role === 'admin') {
            q = collection(db, DB_COLLECTIONS);
        } else {
            q = query(collection(db, DB_COLLECTIONS), where('userId', '==', req.user.id));
        }

        const snapshot = await getDocs(q);
        const folders = [];
        snapshot.forEach(doc => folders.push({ id: doc.id, ...doc.data() }));

        res.json({ success: true, data: folders });
    } catch (err) {
        console.error("Error fetching collections:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/collections
app.post('/api/collections', authenticateToken, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, error: 'Name is required' });
    }

    try {
        const newDocRef = await addDoc(collection(db, DB_COLLECTIONS), {
            name: name.trim(),
            userId: req.user.id,
            username: req.user.username,
            displayName: req.user.displayName || req.user.username,
            createdAt: new Date().toISOString()
        });

        res.json({
            success: true,
            data: { id: newDocRef.id, name: name.trim(), userId: req.user.id }
        });
    } catch (err) {
        console.error("Error creating collection:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/collections/:id (Rename)
app.put('/api/collections/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, error: 'Name is required' });
    }

    try {
        const docRef = doc(db, DB_COLLECTIONS, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        if (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized to rename this collection' });
        }

        await updateDoc(docRef, { name: name.trim() });
        res.json({ success: true, message: 'Collection renamed successfully' });
    } catch (err) {
        console.error("Error renaming collection:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/collections/:id
app.delete('/api/collections/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const docRef = doc(db, DB_COLLECTIONS, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Collection not found' });
        }

        if (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized to delete this collection' });
        }

        await deleteDoc(docRef);

        // Remove this collection ID from all records that have it
        const recordsQuery = query(collection(db, DB_COLLECTION), where('collections', 'array-contains', id));
        const recordsSnapshot = await getDocs(recordsQuery);
        const batchUpdates = [];
        recordsSnapshot.forEach(recordDoc => {
            const currentCollections = recordDoc.data().collections || [];
            batchUpdates.push(
                updateDoc(doc(db, DB_COLLECTION, recordDoc.id), {
                    collections: currentCollections.filter(cId => cId !== id)
                })
            );
        });
        await Promise.all(batchUpdates);

        res.json({ success: true, message: 'Collection deleted successfully' });
    } catch (err) {
        console.error("Error deleting collection:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/records/:id/collections
app.put('/api/records/:id/collections', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { collectionIds } = req.body; // Expecting an array of collection IDs

    if (!Array.isArray(collectionIds)) {
        return res.status(400).json({ success: false, error: 'collectionIds must be an array' });
    }

    try {
        const docRef = doc(db, DB_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (req.user.role !== 'admin') {
            if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Unauthorized to update collections for this record' });
            }
        }

        if (docSnap.exists()) {
            await updateDoc(docRef, { collections: collectionIds });
            res.json({ success: true, message: 'Collections updated successfully' });
        } else {
            res.status(404).json({ success: false, error: 'Record not found' });
        }
    } catch (err) {
        console.error("Error updating document collections:", err);
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

// Trade Feed: Create
app.post('/api/trades', authenticateToken, async (req, res) => {
    try {
        const {
            offeredType, offeredDetails, offeredData,
            requestedType, requestedDetails, requestedData,
            quotedListing
        } = req.body;

        const newTrade = {
            userId: req.user.id,
            userName: req.user.displayName || req.user.username,
            userColor: req.user.userColor || '#3b82f6',
            offeredType,
            offeredDetails,
            offeredData: offeredData || {},
            requestedType,
            requestedDetails,
            requestedData: requestedData || {},
            quotedListing: quotedListing || null,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, DB_TRADES), newTrade);

        await logActivity({
            listingId: docRef.id,
            listingTitle: `Takas Talebi: ${offeredType} -> ${requestedType}`,
            action: 'trade_created',
            by: req.user.displayName || req.user.username,
            byId: req.user.id
        });

        res.json({ success: true, data: { id: docRef.id, ...newTrade } });
    } catch (err) {
        console.error("POST /api/trades Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Trade Feed: List with Filtering
app.get('/api/trades', authenticateToken, async (req, res) => {
    try {
        const { offeredType, requestedType, status } = req.query;
        let q = collection(db, DB_TRADES);

        // Building conditional queries
        const constraints = [];
        if (offeredType) constraints.push(where("offeredType", "==", offeredType));
        if (requestedType) constraints.push(where("requestedType", "==", requestedType));
        if (status) constraints.push(where("status", "==", status));

        const queryRef = constraints.length > 0 ? query(q, ...constraints) : q;
        const snap = await getDocs(queryRef);

        const trades = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        trades.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ success: true, data: trades });
    } catch (err) {
        console.error("GET /api/trades Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Trade Feed: Request Match
app.post('/api/trades/:id/match-request', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tradeRef = doc(db, DB_TRADES, id);
        const tradeSnap = await getDoc(tradeRef);

        if (!tradeSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Takas talebi bulunamadı.' });
        }

        const tradeData = tradeSnap.data();
        if (tradeData.userId === req.user.id) {
            return res.status(400).json({ success: false, error: 'Kendi talebinize eşleşme isteği gönderemezsiniz.' });
        }

        // Check if already requested
        const q = query(
            collection(db, DB_TRADE_REQUESTS),
            where("tradeId", "==", id),
            where("senderId", "==", req.user.id)
        );
        const existingSnap = await getDocs(q);
        if (!existingSnap.empty) {
            return res.status(400).json({ success: false, error: 'Bu talep için zaten bir eşleşme isteği gönderdiniz.' });
        }

        const newRequest = {
            tradeId: id,
            tradeTitle: `${tradeData.offeredType} -> ${tradeData.requestedType}`,
            senderId: req.user.id,
            senderName: req.user.displayName || req.user.username,
            senderColor: req.user.userColor || '#3b82f6',
            receiverId: tradeData.userId,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, DB_TRADE_REQUESTS), newRequest);
        res.json({ success: true, data: { id: docRef.id, ...newRequest } });
    } catch (err) {
        console.error("POST /api/trades/:id/match-request Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Trade Feed: Get Match Requests for a trade (Owner Only)
app.get('/api/trades/:id/match-requests', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tradeSnap = await getDoc(doc(db, DB_TRADES, id));
        if (!tradeSnap.exists() || tradeSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Yetkisiz erişim.' });
        }

        const q = query(collection(db, DB_TRADE_REQUESTS), where("tradeId", "==", id));
        const snap = await getDocs(q);
        const requests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({ success: true, data: requests });
    } catch (err) {
        console.error("GET /api/match-requests Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Trade Feed: Respond to Match Request
app.post('/api/match-requests/:id/respond', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'approve' or 'reject'
        const reqRef = doc(db, DB_TRADE_REQUESTS, id);
        const reqSnap = await getDoc(reqRef);

        if (!reqSnap.exists()) {
            return res.status(404).json({ success: false, error: 'İstek bulunamadı.' });
        }

        const requestData = reqSnap.data();
        if (requestData.receiverId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Yetkisiz işlem.' });
        }

        if (action === 'approve') {
            await updateDoc(reqRef, { status: 'approved' });

            // Update the trade document to include the matched user
            const tradeRef = doc(db, DB_TRADES, requestData.tradeId);
            const tradeSnap = await getDoc(tradeRef);
            if (tradeSnap.exists()) {
                const tradeData = tradeSnap.data();
                const matchedWith = tradeData.matchedWith || [];

                // Add if not already present
                if (!matchedWith.some(m => m.userId === requestData.senderId)) {
                    matchedWith.push({
                        userId: requestData.senderId,
                        userName: requestData.senderName,
                        userColor: requestData.senderColor,
                        matchedAt: new Date().toISOString()
                    });
                    await updateDoc(tradeRef, { matchedWith });
                }
            }
        } else {
            await updateDoc(reqRef, { status: 'rejected' });
        }

        res.json({ success: true, message: `İstek ${action === 'approve' ? 'onaylandı' : 'reddedildi'}.` });
    } catch (err) {
        console.error("POST /api/match-requests/:id/respond Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Trade Feed: Matches for a specific trade post
app.get('/api/trades/:id/matches', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tradeSnap = await getDoc(doc(db, DB_TRADES, id));

        if (!tradeSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Takas talebi bulunamadı.' });
        }

        const trade = tradeSnap.data();
        const requestedType = (trade.requestedType || '').toLowerCase();
        const requestedDetails = (trade.requestedDetails || '').toLowerCase();
        const requestedData = trade.requestedData || {};

        // Normalization helper for better matching
        const normalize = (str) => {
            if (!str) return '';
            return str.toLowerCase()
                .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
                .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
                .replace(/[^a-z0-9]/g, ' ')
                .trim();
        };

        const reqTypeNorm = normalize(requestedType);
        const reqRegNorm = normalize(requestedData.region);

        // Fetch active listings
        const recordsSnap = await getDocs(collection(db, DB_COLLECTION));
        const matches = [];

        recordsSnap.forEach(docSnap => {
            const record = { id: docSnap.id, ...docSnap.data() };
            if (record.status !== 'approved') return;

            let score = 0;
            const recMainCat = normalize(record.mainCategory || '');
            const recSubCat = normalize(record.subCategory || '');
            const recTitle = normalize(record.title || '');
            const recLoc = normalize(record.location || '');
            const props = record.properties || {};

            // 1. Category Match (High Priority)
            if (recSubCat === reqTypeNorm || recMainCat.includes(reqTypeNorm) || reqTypeNorm.includes(recSubCat)) {
                score += 50;
            } else if (reqTypeNorm === 'konut' && (recSubCat === 'daire' || recSubCat === 'villa' || recSubCat === 'rezidans')) {
                score += 45; // Contextual mapping
            } else if ((reqTypeNorm === 'arsa' || reqTypeNorm === 'arazi') && (recSubCat === 'tarla' || recSubCat === 'bahce' || recSubCat === 'arsa')) {
                score += 45;
            }

            // 2. Location Match
            if (reqRegNorm && recLoc.includes(reqRegNorm)) {
                score += 35;
            }

            // 3. Structured Data Match
            if (requestedData.rooms) {
                const recRooms = props['Oda Sayısı'] || '';
                if (recRooms && recRooms.includes(requestedData.rooms)) score += 20;
            }

            if (requestedData.sqm) {
                const recSqm = parseInt(props['m² (Net)'] || props['m² (Brüt)'] || '0');
                const reqSqm = parseInt(requestedData.sqm);
                if (recSqm && reqSqm && Math.abs(recSqm - reqSqm) < (reqSqm * 0.2)) score += 15; // Within 20%
            }

            if (requestedData.fuel) {
                const recFuel = normalize(props['Yakıt Tipi'] || '');
                if (recFuel && recFuel.includes(normalize(requestedData.fuel))) score += 15;
            }

            if (requestedData.model) {
                const recModel = normalize(props['Model'] || props['Seri'] || '');
                if (recModel && recModel.includes(normalize(requestedData.model))) score += 20;
            }

            // 4. Keyword Match
            if (requestedDetails) {
                const keywords = normalize(requestedDetails).split(' ').filter(k => k.length > 2);
                let keywordMatches = 0;
                keywords.forEach(word => {
                    if (recTitle.includes(word) || normalize(record.description || '').includes(word)) {
                        keywordMatches++;
                    }
                });
                score += (keywordMatches * 5);
            }

            if (score >= 40) { // Minimum threshold for "Smart Match"
                matches.push({ ...record, matchScore: score });
            }
        });

        matches.sort((a, b) => b.matchScore - a.matchScore);
        res.json({ success: true, data: matches.slice(0, 15) });
    } catch (err) {
        console.error("GET /api/trades/:id/matches Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Trade Feed: Delete
app.delete('/api/trades/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const docRef = doc(db, DB_TRADES, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
        }

        if (req.user.role !== 'admin' && docSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Yetkisiz işlem.' });
        }

        await deleteDoc(docRef);
        res.json({ success: true, message: 'Takas talebi silindi.' });
    } catch (err) {
        console.error("DELETE /api/trades Error:", err);
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

// Excel List Management (Restructured for Workbooks)
app.get('/api/excel-lists', authenticateToken, async (req, res) => {
    try {
        const q = query(collection(db, DB_EXCEL_LISTS), where("userId", "==", req.user.id));
        const snap = await getDocs(q);
        const lists = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Manual sort in JS
        lists.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        res.json({ success: true, data: lists });
    } catch (err) {
        console.error("GET /api/excel-lists Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/excel-lists', authenticateToken, async (req, res) => {
    try {
        const { fileName, sheets } = req.body;
        if (!fileName || !sheets || !Array.isArray(sheets)) {
            return res.status(400).json({ success: false, error: 'Eksik bilgi: Dosya adı ve sayfalar zorunludur.' });
        }

        const newWorkbook = {
            userId: req.user.id,
            userName: req.user.displayName || req.user.username,
            listName: fileName, // Use fileName as listName for backward compatibility and sidebar
            sheets: sheets.map(s => ({
                name: s.name,
                headers: s.headers,
                data: s.data,
                styles: s.styles || {}
            })),
            isWorkbook: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, DB_EXCEL_LISTS), newWorkbook);
        res.json({ success: true, message: 'Çalışma kitabı kaydedildi', data: { id: docRef.id, ...newWorkbook } });
    } catch (err) {
        console.error("POST /api/excel-lists Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/excel-lists/:id', authenticateToken, async (req, res) => {
    try {
        const docRef = doc(db, DB_EXCEL_LISTS, req.params.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Yetkisiz erişim veya bulunamadı.' });
        }
        res.json({ success: true, data: { id: docSnap.id, ...docSnap.data() } });
    } catch (err) {
        console.error("GET /api/excel-lists/:id Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/excel-lists/:id', authenticateToken, async (req, res) => {
    try {
        const docRef = doc(db, DB_EXCEL_LISTS, req.params.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Yetkisiz erişim.' });
        }

        const updates = { ...req.body, updatedAt: new Date().toISOString() };
        await updateDoc(docRef, updates);
        res.json({ success: true, message: 'Liste güncellendi' });
    } catch (err) {
        console.error("PUT /api/excel-lists/:id Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/excel-lists/:id', authenticateToken, async (req, res) => {
    try {
        const docRef = doc(db, DB_EXCEL_LISTS, req.params.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || docSnap.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Yetkisiz erişim.' });
        }

        await deleteDoc(docRef);
        res.json({ success: true, message: 'Liste silindi' });
    } catch (err) {
        console.error("DELETE /api/excel-lists/:id Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Export the Express API for Vercel Serverless Functions
module.exports = app;

// Global Catch-all Error Handler
app.use((err, req, res, next) => {
    console.error('[GLOBAL ERROR HANDLER]', err);
    res.status(500).json({ success: false, error: err.message || 'Interal Server Error' });
});

// Only listen locally if not running on Vercel
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server API running on http://localhost:${PORT}`);
        console.log('Connected to Firebase Firestore.');
    });
}
