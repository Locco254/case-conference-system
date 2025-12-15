const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");

const app = express();

/* =======================
   MIDDLEWARE
======================= */

app.use(express.json());

app.use(cors({
    origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ],
    credentials: true
}));

app.use(session({
    secret: "case-conference-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Render uses HTTPS automatically
        httpOnly: true
    }
}));

/* =======================
   HARDCODED USERS (FOR NOW)
======================= */

const users = [
    {
        id: 1,
        email: "admin@schools.org",
        password: "admin123",
        role: "admin"
    },
    {
        id: 2,
        email: "teacher@test.com",
        password: "teacher123",
        role: "teacher"
    }
];

/* =======================
   PUBLIC ROUTE (TEST)
======================= */

app.get("/", (req, res) => {
    res.json({ message: "Backend is running" });
});

/* =======================
   LOGIN ROUTE
======================= */

app.post("/api/login", (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const user = users.find(
        u =>
            u.email === email &&
            u.password === password &&
            u.role === role
    );

    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role
    };

    res.json({
        message: "Login successful",
        user: req.session.user
    });
});

/* =======================
   AUTH MIDDLEWARE
======================= */

function isAuthenticated(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

/* =======================
   PROTECTED ROUTE EXAMPLE
======================= */

app.get("/api/dashboard", isAuthenticated, (req, res) => {
    res.json({
        message: "Welcome to dashboard",
        user: req.session.user
    });
});

/* =======================
   START SERVER
======================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
