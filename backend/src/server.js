const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// =======================
// Middleware
// =======================
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'case-conference-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// =======================
// PUBLIC ROOT ROUTE (NO AUTH)
// =======================
app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "Case Conference Backend is live and running"
    });
});

// =======================
// In-memory database
// =======================
let database = {
    users: [],
    students: [
        {
            id: 'ST001',
            name: 'Emma Wilson',
            dob: '2018-03-15',
            gender: 'female',
            school: 'S001',
            disabilityCategory: 'autism',
            iepDate: '2023-01-15',
            notes: 'Responds well to visual schedules',
            status: 'active',
            assignedTeacher: 'T001',
            forms: {
                progress: { status: 'completed', lastUpdated: '2024-01-15' },
                assessment: { status: 'pending' },
                iep: { status: 'completed', lastUpdated: '2024-01-10' }
            },
            createdAt: new Date().toISOString(),
            createdBy: 'A001'
        }
    ],
    teachers: [],
    schools: [],
    parents: [],
    systemLogs: [],
    settings: {
        systemName: 'Case Conference System'
    }
};

// =======================
// Initialize demo users
// =======================
(async () => {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    database.users.push({
        id: 'A001',
        name: 'System Administrator',
        email: 'admin@schools.org',
        password: hashedPassword,
        userType: 'admin',
        createdAt: new Date().toISOString()
    });
})();

// =======================
// AUTHENTICATION MIDDLEWARE
// =======================
function authenticate(req, res, next) {
    const publicRoutes = ['/', '/api/login', '/api/health'];
    if (publicRoutes.includes(req.path) || req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

app.use(authenticate);

// =======================
// API ROUTES
// =======================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        users: database.users.length,
        students: database.students.length
    });
});

app.post('/api/login', async (req, res) => {
    const { email, password, userType } = req.body;

    let user = database.users.find(
        u => u.email === email && u.userType === userType
    );

    if (!user) {
        const hashed = await bcrypt.hash(password || 'demo123', 10);
        user = {
            id: 'U' + Date.now(),
            name: email.split('@')[0],
            email,
            password: hashed,
            userType
        };
        database.users.push(user);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = user;
    res.json({ success: true, user });
});

// =======================
// ERROR HANDLER
// =======================
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
