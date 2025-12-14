const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
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
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// In-memory database with demo data
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
        },
        {
            id: 'ST002',
            name: 'James Miller',
            dob: '2019-07-22',
            gender: 'male',
            school: 'S002',
            disabilityCategory: 'speech',
            iepDate: '2023-02-20',
            notes: 'Working on articulation',
            status: 'active',
            assignedTeacher: 'T001',
            forms: {
                progress: { status: 'in-progress' },
                assessment: { status: 'completed', lastUpdated: '2024-01-05' },
                iep: { status: 'pending' }
            },
            createdAt: new Date().toISOString(),
            createdBy: 'T001'
        }
    ],
    teachers: [
        {
            id: 'T001',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@schools.org',
            phone: '555-0101',
            userType: 'teacher',
            assignedSchools: ['S001', 'S002'],
            students: ['ST001', 'ST002'],
            profile: {
                qualifications: 'M.Ed Special Education',
                yearsExperience: 8,
                certifications: ['State Teaching License', 'Special Education Endorsement'],
                bio: 'Dedicated special education teacher with focus on early childhood development.'
            },
            createdAt: new Date().toISOString(),
            status: 'active'
        },
        {
            id: 'T002',
            name: 'Michael Brown',
            email: 'michael.brown@schools.org',
            phone: '555-0102',
            userType: 'teacher',
            assignedSchools: ['S003'],
            students: ['ST003'],
            profile: {
                qualifications: 'B.Ed Elementary Education',
                yearsExperience: 5,
                certifications: ['State Teaching License'],
                bio: 'Passionate about creating inclusive learning environments.'
            },
            createdAt: new Date().toISOString(),
            status: 'active'
        }
    ],
    schools: [
        {
            id: 'S001',
            name: 'Sunrise Elementary School',
            type: 'public',
            address: '123 Main Street, Anytown',
            phone: '555-1000',
            principal: 'Dr. Robert Wilson',
            grades: 'K-5',
            enrollment: 450,
            specialEdCoordinator: 'Ms. Jennifer Lee',
            teachers: ['T001'],
            facilities: ['Resource Room', 'Speech Therapy Room', 'Occupational Therapy Space'],
            status: 'active'
        },
        {
            id: 'S002',
            name: 'Little Explorers Preschool',
            type: 'private',
            address: '456 Oak Avenue, Anytown',
            phone: '555-1001',
            director: 'Mrs. Maria Garcia',
            grades: 'Pre-K',
            enrollment: 80,
            specialEdCoordinator: 'Mr. David Chen',
            teachers: ['T001'],
            facilities: ['Play Therapy Room', 'Sensory Room'],
            status: 'active'
        }
    ],
    parents: [
        {
            id: 'P001',
            name: 'Lisa Wilson',
            email: 'lisa.wilson@family.org',
            phone: '555-0123',
            userType: 'parent',
            children: ['ST001'],
            emergencyContact: {
                name: 'John Wilson',
                relationship: 'Grandfather',
                phone: '555-0124'
            },
            createdAt: new Date().toISOString(),
            status: 'active'
        }
    ],
    systemLogs: [],
    settings: {
        systemName: 'Case Conference System',
        autoBackup: true,
        backupFrequency: 'weekly',
        sessionTimeout: 30,
        emailNotifications: true,
        reportRetention: 365,
        dataExportFormat: 'json'
    }
};

// Initialize admin user
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
    
    // Add existing teachers and parents to users
    database.teachers.forEach(teacher => {
        database.users.push({
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            password: bcrypt.hashSync('teacher123', 10),
            userType: 'teacher'
        });
    });
    
    database.parents.forEach(parent => {
        database.users.push({
            id: parent.id,
            name: parent.name,
            email: parent.email,
            password: bcrypt.hashSync('parent123', 10),
            userType: 'parent'
        });
    });
})();

// Authentication middleware
function authenticate(req, res, next) {
    const publicRoutes = ['/api/login', '/api/health', '/api/register'];
    if (publicRoutes.includes(req.path) || req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

app.use(authenticate);

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        users: database.users.length,
        students: database.students.length
    });
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, userType } = req.body;
        
        let user = database.users.find(u => u.email === email && u.userType === userType);
        
        if (!user) {
            // Auto-create demo account
            const idPrefix = userType === 'teacher' ? 'T' : userType === 'parent' ? 'P' : 'U';
            const hashedPassword = await bcrypt.hash(password || 'demo123', 10);
            
            user = {
                id: `${idPrefix}${Date.now().toString().slice(-6)}`,
                name: email.split('@')[0],
                email,
                password: hashedPassword,
                userType,
                createdAt: new Date().toISOString()
            };
            
            database.users.push(user);
            
            // Add to appropriate collection
            if (userType === 'teacher') {
                const teacher = {
                    ...user,
                    assignedSchools: ['S001'],
                    students: [],
                    profile: { 
                        qualifications: '', 
                        yearsExperience: 0, 
                        certifications: [] 
                    },
                    status: 'active'
                };
                database.teachers.push(teacher);
            } else if (userType === 'parent') {
                const parent = {
                    ...user,
                    children: ['ST001'],
                    emergencyContact: {
                        name: 'Emergency Contact',
                        relationship: 'Parent',
                        phone: '555-0000'
                    },
                    status: 'active'
                };
                database.parents.push(parent);
            }
            
            user = database.users.find(u => u.email === email);
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        req.session.user = user;
        
        // Get full user data based on type
        let userData = user;
        if (user.userType === 'teacher') {
            userData = database.teachers.find(t => t.id === user.id) || user;
        } else if (user.userType === 'parent') {
            userData = database.parents.find(p => p.id === user.id) || user;
        }
        
        // Log activity
        database.systemLogs.push({
            action: `User logged in: ${user.name}`,
            user: user.name,
            timestamp: new Date().toISOString()
        });
        
        res.json({ 
            success: true, 
            user: userData,
            message: 'Login successful' 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user
app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        let userData = req.session.user;
        // Get full data based on user type
        if (userData.userType === 'teacher') {
            userData = database.teachers.find(t => t.id === userData.id) || userData;
        } else if (userData.userType === 'parent') {
            userData = database.parents.find(p => p.id === userData.id) || userData;
        }
        res.json(userData);
    } else {
        res.status(401).json(null);
    }
});

// Dashboard stats
app.get('/api/dashboard-stats', (req, res) => {
    const user = req.session.user;
    let stats = {};
    
    switch(user.userType) {
        case 'admin':
            stats = {
                totalStudents: database.students.length,
                totalTeachers: database.teachers.length,
                totalSchools: database.schools.length,
                totalParents: database.parents.length,
                pendingForms: database.students.filter(s => s.forms?.progress?.status !== 'completed').length
            };
            break;
        case 'teacher':
            const teacherStudents = database.students.filter(s => s.assignedTeacher === user.id);
            stats = {
                totalStudents: teacherStudents.length,
                pendingForms: teacherStudents.filter(s => s.forms?.progress?.status !== 'completed').length,
                completedForms: teacherStudents.filter(s => s.forms?.progress?.status === 'completed').length,
                assignedSchools: database.teachers.find(t => t.id === user.id)?.assignedSchools?.length || 0
            };
            break;
        case 'parent':
            const parent = database.parents.find(p => p.id === user.id);
            const children = parent?.children || [];
            stats = {
                childrenCount: children.length,
                upcomingMeetings: 2, // Demo data
                unreadMessages: 1, // Demo data
                newDocuments: 3 // Demo data
            };
            break;
    }
    
    res.json(stats);
});

// Students
app.get('/api/students', (req, res) => {
    const user = req.session.user;
    let students = [...database.students];
    
    // Filter based on user type
    if (user.userType === 'teacher') {
        students = students.filter(s => s.assignedTeacher === user.id);
    } else if (user.userType === 'parent') {
        const parent = database.parents.find(p => p.id === user.id);
        students = students.filter(s => parent?.children?.includes(s.id));
    }
    
    res.json(students);
});

app.post('/api/students', (req, res) => {
    const student = {
        id: 'ST' + Date.now().toString().slice(-4),
        ...req.body,
        createdAt: new Date().toISOString(),
        createdBy: req.session.user.id,
        forms: {
            progress: { status: 'pending' },
            assessment: { status: 'pending' },
            iep: { status: 'pending' }
        },
        status: 'active'
    };
    
    database.students.push(student);
    
    // Update teacher's student list
    if (student.assignedTeacher) {
        const teacher = database.teachers.find(t => t.id === student.assignedTeacher);
        if (teacher && !teacher.students.includes(student.id)) {
            teacher.students.push(student.id);
        }
    }
    
    // Log activity
    database.systemLogs.push({
        action: `Added student: ${student.name}`,
        user: req.session.user.name,
        timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, student });
});

// Teachers
app.get('/api/teachers', (req, res) => {
    res.json(database.teachers);
});

app.post('/api/teachers', (req, res) => {
    const teacher = {
        id: 'T' + Date.now().toString().slice(-4),
        ...req.body,
        userType: 'teacher',
        students: [],
        createdAt: new Date().toISOString(),
        status: 'active'
    };
    
    database.teachers.push(teacher);
    
    // Add to users
    const hashedPassword = bcrypt.hashSync(teacher.password, 10);
    database.users.push({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        password: hashedPassword,
        userType: 'teacher'
    });
    
    database.systemLogs.push({
        action: `Added teacher: ${teacher.name}`,
        user: req.session.user.name,
        timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, teacher });
});

// Schools
app.get('/api/schools', (req, res) => {
    res.json(database.schools);
});

app.post('/api/schools', (req, res) => {
    const school = {
        id: 'S' + Date.now().toString().slice(-4),
        ...req.body,
        teachers: [],
        createdAt: new Date().toISOString(),
        status: 'active'
    };
    
    database.schools.push(school);
    
    database.systemLogs.push({
        action: `Added school: ${school.name}`,
        user: req.session.user.name,
        timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, school });
});

// Parents
app.get('/api/parents', (req, res) => {
    res.json(database.parents);
});

app.post('/api/parents', (req, res) => {
    const parent = {
        id: 'P' + Date.now().toString().slice(-4),
        ...req.body,
        userType: 'parent',
        createdAt: new Date().toISOString(),
        status: 'active'
    };
    
    database.parents.push(parent);
    
    // Add to users
    const hashedPassword = bcrypt.hashSync(parent.password, 10);
    database.users.push({
        id: parent.id,
        name: parent.name,
        email: parent.email,
        password: hashedPassword,
        userType: 'parent'
    });
    
    database.systemLogs.push({
        action: `Added parent: ${parent.name}`,
        user: req.session.user.name,
        timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, parent });
});

// System logs
app.get('/api/logs', (req, res) => {
    res.json(database.systemLogs.slice(-10).reverse());
});

// Settings
app.get('/api/settings', (req, res) => {
    res.json(database.settings);
});

app.put('/api/settings', (req, res) => {
    database.settings = { ...database.settings, ...req.body };
    
    database.systemLogs.push({
        action: 'Updated system settings',
        user: req.session.user.name,
        timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, settings: database.settings });
});

// Update student progress
app.post('/api/students/:id/progress', (req, res) => {
    const { id } = req.params;
    const progressData = req.body;
    
    const studentIndex = database.students.findIndex(s => s.id === id);
    if (studentIndex === -1) {
        return res.status(404).json({ error: 'Student not found' });
    }
    
    database.students[studentIndex].forms.progress = {
        ...progressData,
        status: 'completed',
        lastUpdated: new Date().toISOString()
    };
    
    database.systemLogs.push({
        action: `Updated progress for student: ${database.students[studentIndex].name}`,
        user: req.session.user.name,
        timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, student: database.students[studentIndex] });
});

// Delete items (admin only)
app.delete('/api/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const user = req.session.user;
    
    if (user.userType !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    let collection;
    switch(type) {
        case 'students':
            collection = database.students;
            break;
        case 'teachers':
            collection = database.teachers;
            break;
        case 'schools':
            collection = database.schools;
            break;
        case 'parents':
            collection = database.parents;
            break;
        default:
            return res.status(400).json({ error: 'Invalid type' });
    }
    
    const itemIndex = collection.findIndex(item => item.id === id);
    if (itemIndex === -1) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    const itemName = collection[itemIndex].name;
    collection.splice(itemIndex, 1);
    
    // Also remove from users if applicable
    if (type === 'teachers' || type === 'parents') {
        database.users = database.users.filter(u => u.id !== id);
    }
    
    database.systemLogs.push({
        action: `Deleted ${type.slice(0, -1)}: ${itemName}`,
        user: user.name,
        timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: `${type.slice(0, -1)} deleted successfully` });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'frontend')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    });
} else {
    // In development, still serve API
    app.get('/', (req, res) => {
        res.json({ message: 'API is running. Go to http://localhost:3000 for frontend.' });
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});