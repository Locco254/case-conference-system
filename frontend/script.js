class CaseConferenceSystem {
    constructor() {
        this.currentUser = null;
        this.apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api'
            : '/api';
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.checkAuthentication();
    }

    // ==================== API COMMUNICATION ====================
    
    async apiRequest(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 401) {
                    // Session expired
                    this.showNotification('Session expired. Please login again.', 'warning');
                    setTimeout(() => this.logout(), 2000);
                }
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                this.showNotification('Request timeout. Please check your connection.', 'error');
            } else {
                console.error('API Request failed:', error);
                this.showNotification('Connection error. Please try again.', 'error');
            }
            throw error;
        }
    }

    // ==================== AUTHENTICATION ====================

    async checkAuthentication() {
        try {
            const user = await this.apiRequest('/current-user');
            if (user) {
                this.currentUser = user;
                this.initializeDashboard();
            } else if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
        } catch (error) {
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const loginData = {
            email: formData.get('username'),
            password: formData.get('password'),
            userType: formData.get('userType')
        };

        try {
            const data = await this.apiRequest('/login', {
                method: 'POST',
                body: JSON.stringify(loginData)
            });

            if (data.success) {
                this.currentUser = data.user;
                this.showNotification(data.message || 'Login successful!', 'success');
                
                // Add login animation
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) {
                    loginBtn.innerHTML = '<i class="fas fa-check"></i> Success!';
                    loginBtn.classList.add('btn-success');
                    
                    setTimeout(() => {
                        this.redirectToDashboard();
                    }, 1000);
                } else {
                    this.redirectToDashboard();
                }
            }
        } catch (error) {
            this.showNotification('Login failed. Please check your credentials.', 'error');
            
            // Reset login button
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to System';
            }
        }
    }

    async logout() {
        try {
            await this.apiRequest('/logout', { method: 'POST' });
            this.currentUser = null;
            this.showNotification('Logged out successfully', 'info');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error('Logout failed:', error);
            window.location.href = 'index.html';
        }
    }

    redirectToDashboard() {
        if (!this.currentUser) return;
        
        setTimeout(() => {
            if (this.currentUser.userType === 'admin') {
                window.location.href = 'admin.html';
            } else if (this.currentUser.userType === 'parent') {
                window.location.href = 'parent.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 500);
    }

    clearSession() {
        this.currentUser = null;
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(";").forEach(cookie => {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        this.showNotification('Session cleared. Refresh the page.', 'info');
    }

    // ==================== DASHBOARD INITIALIZATION ====================

    async initializeDashboard() {
        if (!this.currentUser) return;

        // Update user info
        const currentUserElement = document.getElementById('currentUser');
        const userAvatar = document.getElementById('userAvatar');
        
        if (currentUserElement) {
            currentUserElement.textContent = this.currentUser.name;
        }
        
        if (userAvatar) {
            const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
            userAvatar.textContent = initials || 'U';
        }

        // Initialize based on user type
        switch(this.currentUser.userType) {
            case 'teacher':
                await this.initializeTeacherDashboard();
                break;
            case 'admin':
                await this.initializeAdminDashboard();
                break;
            case 'parent':
                await this.initializeParentDashboard();
                break;
        }

        // Load common data
        await this.loadDashboardStats();
        this.setupTabNavigation();
        this.enhanceUIElements();
    }

    async initializeTeacherDashboard() {
        await this.loadStudents();
        await this.loadSchools();
        this.setupTeacherQuickActions();
    }

    async initializeAdminDashboard() {
        await this.loadAllTeachers();
        await this.loadAllParents();
        await this.loadAllSchools();
        await this.loadSystemLogs();
        this.setupAdminQuickActions();
    }

    async initializeParentDashboard() {
        await this.loadParentStudents();
        await this.loadParentMeetings();
        await this.loadParentDocuments();
        this.setupParentQuickActions();
    }

    // ==================== DATA LOADING ====================

    async loadDashboardStats() {
        try {
            const stats = await this.apiRequest('/dashboard-stats');
            this.updateStatsDisplay(stats);
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    updateStatsDisplay(stats) {
        // Update stats cards based on user type
        Object.keys(stats).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = stats[key];
                
                // Add counting animation
                const target = stats[key];
                const current = parseInt(element.textContent) || 0;
                if (current !== target) {
                    this.animateCounter(element, current, target, 1000);
                }
            }
        });
    }

    animateCounter(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.textContent = value;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    async loadStudents() {
        try {
            const students = await this.apiRequest('/students');
            this.renderStudents(students);
        } catch (error) {
            console.error('Failed to load students:', error);
            this.showNotification('Failed to load students', 'error');
        }
    }

    async loadAllTeachers() {
        try {
            const teachers = await this.apiRequest('/teachers');
            this.renderTeachers(teachers);
        } catch (error) {
            console.error('Failed to load teachers:', error);
        }
    }

    async loadAllParents() {
        try {
            const parents = await this.apiRequest('/parents');
            this.renderParents(parents);
        } catch (error) {
            console.error('Failed to load parents:', error);
        }
    }

    async loadAllSchools() {
        try {
            const schools = await this.apiRequest('/schools');
            this.renderSchools(schools);
        } catch (error) {
            console.error('Failed to load schools:', error);
        }
    }

    async loadSystemLogs() {
        try {
            const logs = await this.apiRequest('/logs');
            this.renderSystemLogs(logs);
        } catch (error) {
            console.error('Failed to load system logs:', error);
        }
    }

    async loadParentStudents() {
        try {
            const students = await this.apiRequest('/students');
            this.renderParentStudents(students);
        } catch (error) {
            console.error('Failed to load parent students:', error);
        }
    }

    // ==================== RENDERING ====================

    renderStudents(students) {
        const container = document.getElementById('studentList') || document.getElementById('allStudentsList');
        if (!container) return;

        if (students.length === 0) {
            container.innerHTML = `
                <div class="no-data" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <i class="fas fa-users fa-3x" style="color: #ddd; margin-bottom: 1rem;"></i>
                    <h3>No Students Found</h3>
                    <p>Get started by adding your first student.</p>
                    <button class="btn btn-primary" onclick="system.showModal('addStudentModal')">
                        <i class="fas fa-user-plus"></i> Add First Student
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        students.forEach(student => {
            const card = this.createStudentCard(student);
            container.appendChild(card);
        });
    }

    createStudentCard(student) {
        const card = document.createElement('div');
        card.className = 'student-card';
        card.dataset.id = student.id;
        
        const progressStatus = student.forms?.progress?.status || 'Not Started';
        const progressClass = progressStatus === 'completed' ? 'status-active' : 
                            progressStatus === 'in-progress' ? 'status-pending' : 'status-inactive';
        
        card.innerHTML = `
            <h4>${student.name}</h4>
            <div class="student-info">
                <p><strong><i class="fas fa-id-card"></i> ID:</strong> ${student.id}</p>
                <p><strong><i class="fas fa-birthday-cake"></i> Age:</strong> ${this.calculateAge(student.dob)}</p>
                <p><strong><i class="fas fa-school"></i> School:</strong> ${student.school || 'Not assigned'}</p>
                <p><strong><i class="fas fa-user-graduate"></i> Disability:</strong> ${this.formatDisability(student.disabilityCategory)}</p>
                <p><strong><i class="fas fa-chart-line"></i> Progress:</strong> 
                    <span class="status-badge ${progressClass}">${progressStatus}</span>
                </p>
            </div>
            <div class="student-actions">
                <button class="btn btn-primary btn-sm" onclick="system.viewStudentDetails('${student.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="btn btn-secondary btn-sm" onclick="system.editStudent('${student.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                ${this.currentUser.userType === 'admin' ? `
                <button class="btn btn-warning btn-sm" onclick="system.transferStudent('${student.id}')">
                    <i class="fas fa-exchange-alt"></i> Transfer
                </button>
                <button class="btn btn-danger btn-sm" onclick="system.deleteItem('students', '${student.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
                ` : ''}
            </div>
        `;
        
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
        
        return card;
    }

    renderTeachers(teachers) {
        const container = document.getElementById('teachersList');
        if (!container) return;

        if (teachers.length === 0) {
            container.innerHTML = this.createNoDataCard('teachers', 'Add First Teacher');
            return;
        }

        container.innerHTML = '';
        teachers.forEach(teacher => {
            const card = this.createTeacherCard(teacher);
            container.appendChild(card);
        });
    }

    createTeacherCard(teacher) {
        const card = document.createElement('div');
        card.className = 'student-card';
        
        card.innerHTML = `
            <h4>${teacher.name}</h4>
            <div class="student-info">
                <p><strong><i class="fas fa-envelope"></i> Email:</strong> ${teacher.email}</p>
                <p><strong><i class="fas fa-phone"></i> Phone:</strong> ${teacher.phone || 'N/A'}</p>
                <p><strong><i class="fas fa-graduation-cap"></i> Qualifications:</strong> ${teacher.profile?.qualifications || 'N/A'}</p>
                <p><strong><i class="fas fa-briefcase"></i> Experience:</strong> ${teacher.profile?.yearsExperience || 0} years</p>
                <p><strong><i class="fas fa-users"></i> Students:</strong> ${teacher.students?.length || 0}</p>
            </div>
            <div class="student-actions">
                <button class="btn btn-secondary btn-sm" onclick="system.viewTeacherDetails('${teacher.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="btn btn-primary btn-sm" onclick="system.editTeacher('${teacher.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="system.deleteItem('teachers', '${teacher.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        return card;
    }

    // ==================== FORM HANDLING ====================

    async handleAddStudent(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const studentData = {
            name: formData.get('name'),
            dob: formData.get('dob'),
            gender: formData.get('gender'),
            school: formData.get('school'),
            disabilityCategory: formData.get('disabilityCategory'),
            iepDate: formData.get('iepDate'),
            notes: formData.get('notes'),
            assignedTeacher: this.currentUser.userType === 'teacher' ? this.currentUser.id : formData.get('teacher')
        };

        try {
            const result = await this.apiRequest('/students', {
                method: 'POST',
                body: JSON.stringify(studentData)
            });

            if (result.success) {
                this.showNotification(`Student "${result.student.name}" added successfully!`, 'success');
                this.hideModal('addStudentModal');
                e.target.reset();
                await this.loadStudents();
                await this.loadDashboardStats();
            }
        } catch (error) {
            this.showNotification('Failed to add student', 'error');
        }
    }

    async handleAddTeacher(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const teacherData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            password: formData.get('password'),
            profile: {
                qualifications: formData.get('qualifications'),
                yearsExperience: parseInt(formData.get('experience')) || 0,
                certifications: formData.get('certifications')?.split(',').map(c => c.trim()) || [],
                bio: formData.get('bio')
            },
            assignedSchools: Array.from(formData.getAll('schools'))
        };

        try {
            const result = await this.apiRequest('/teachers', {
                method: 'POST',
                body: JSON.stringify(teacherData)
            });

            if (result.success) {
                this.showNotification(`Teacher "${result.teacher.name}" added successfully!`, 'success');
                this.hideModal('addTeacherModal');
                e.target.reset();
                await this.loadAllTeachers();
                await this.loadDashboardStats();
            }
        } catch (error) {
            this.showNotification('Failed to add teacher', 'error');
        }
    }

    // ==================== MODAL MANAGEMENT ====================

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Add animation
            modal.style.animation = 'fadeIn 0.3s ease';
            
            // Focus first input
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
            
            // Load dynamic data if needed
            if (modalId === 'addStudentModal' || modalId === 'adminAddStudentModal') {
                this.populateSchoolAndTeacherDropdowns();
            }
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
                
                // Reset form
                const form = modal.querySelector('form');
                if (form) form.reset();
            }, 300);
        }
    }

    // ==================== UI ENHANCEMENTS ====================

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                               type === 'error' ? 'fa-exclamation-circle' : 
                               type === 'warning' ? 'fa-exclamation-triangle' : 
                               'fa-info-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    enhanceUIElements() {
        // Add ripple effect to all buttons
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                // Create ripple
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.cssText = `
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.6);
                    transform: scale(0);
                    animation: ripple-animation 0.6s linear;
                    width: ${size}px;
                    height: ${size}px;
                    top: ${y}px;
                    left: ${x}px;
                `;
                
                this.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
                
                // Add click animation
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            });
        });

        // Add hover effects to cards
        document.querySelectorAll('.student-card, .teacher-card, .school-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-8px)';
                card.style.boxShadow = '0 15px 30px rgba(0,0,0,0.15)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.boxShadow = '';
            });
        });

        // Add focus styles to form inputs
        document.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('focus', function() {
                this.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', function() {
                this.parentElement.classList.remove('focused');
            });
        });
    }

    // ==================== UTILITY METHODS ====================

    calculateAge(dob) {
        if (!dob) return 'N/A';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    formatDisability(category) {
        const disabilityMap = {
            'autism': 'Autism Spectrum Disorder',
            'learning': 'Specific Learning Disability',
            'speech': 'Speech or Language Impairment',
            'intellectual': 'Intellectual Disability',
            'emotional': 'Emotional Disturbance',
            'other': 'Other Health Impairment'
        };
        return disabilityMap[category] || category || 'Not specified';
    }

    // ==================== EVENT BINDING ====================

    bindEvents() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout button
        document.addEventListener('click', (e) => {
            if (e.target.closest('#logoutBtn')) {
                e.preventDefault();
                this.logout();
            }
        });

        // Modal handling
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') || 
                e.target.classList.contains('cancel-btn') || 
                (e.target.classList.contains('modal') && e.target.id)) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            }
        });

        // Form submissions
        const addStudentForm = document.getElementById('addStudentForm') || 
                               document.getElementById('adminAddStudentForm');
        if (addStudentForm) {
            addStudentForm.addEventListener('submit', (e) => this.handleAddStudent(e));
        }

        const addTeacherForm = document.getElementById('addTeacherForm');
        if (addTeacherForm) {
            addTeacherForm.addEventListener('submit', (e) => this.handleAddTeacher(e));
        }

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.querySelector('.modal[style*="display: flex"]');
                if (modal) {
                    this.hideModal(modal.id);
                }
            }
        });

        // Tab navigation
        document.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('[data-tab]');
            if (tabBtn) {
                e.preventDefault();
                const tabId = tabBtn.getAttribute('data-tab');
                this.switchTab(tabId);
            }
        });
    }

    setupTabNavigation() {
        // Get current tab from URL hash or default to first tab
        const hash = window.location.hash.substring(1);
        const defaultTab = document.querySelector('.tab-content.active')?.id || 
                          document.querySelector('.tab-content')?.id;
        const activeTabId = hash || defaultTab;
        
        if (activeTabId) {
            this.switchTab(activeTabId);
        }
    }

    switchTab(tabId) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab content
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
            selectedTab.classList.add('active');
            selectedTab.style.animation = 'fadeIn 0.3s ease';
        }
        
        // Activate corresponding button
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            
            // Add click animation
            activeBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                activeBtn.style.transform = '';
            }, 150);
        }
        
        // Update URL hash
        window.location.hash = tabId;
        
        // Update page title
        this.updatePageTitle(tabId);
        
        // Load tab-specific data
        this.loadTabData(tabId);
    }

    updatePageTitle(tabId) {
        const pageTitle = document.getElementById('pageTitle');
        if (!pageTitle) return;
        
        const titles = {
            'dashboard': 'Dashboard',
            'overview': 'System Overview',
            'students': 'My Students',
            'all-students': 'All Students',
            'teachers': 'Teacher Management',
            'parents': 'Parent Management',
            'schools': 'Schools & Facilities',
            'forms': 'Case Conference Forms',
            'reports': 'Reports & Analytics',
            'settings': 'System Settings',
            'profile': 'My Profile',
            'meetings': 'Meetings',
            'documents': 'Documents',
            'communications': 'Communications'
        };
        
        pageTitle.textContent = titles[tabId] || 'Dashboard';
        document.title = `${titles[tabId] || 'Dashboard'} - Case Conference System`;
    }

    async loadTabData(tabId) {
        switch(tabId) {
            case 'students':
            case 'all-students':
                await this.loadStudents();
                break;
            case 'teachers':
                await this.loadAllTeachers();
                break;
            case 'parents':
                await this.loadAllParents();
                break;
            case 'schools':
                await this.loadAllSchools();
                break;
            case 'reports':
                await this.loadSystemLogs();
                break;
            case 'dashboard':
            case 'overview':
                await this.loadDashboardStats();
                break;
        }
    }

    // ==================== DEMO METHODS ====================

    // These methods would be fully implemented in a real application
    viewStudentDetails(studentId) {
        this.showNotification(`Viewing student details for ID: ${studentId}`, 'info');
    }

    editStudent(studentId) {
        this.showNotification(`Editing student: ${studentId}`, 'warning');
    }

    transferStudent(studentId) {
        this.showNotification(`Transferring student: ${studentId}`, 'warning');
    }

    deleteItem(type, id) {
        if (confirm(`Are you sure you want to delete this ${type.slice(0, -1)}?`)) {
            this.showNotification(`Deleted ${type.slice(0, -1)}: ${id}`, 'success');
        }
    }

    viewTeacherDetails(teacherId) {
        this.showNotification(`Viewing teacher details for ID: ${teacherId}`, 'info');
    }

    editTeacher(teacherId) {
        this.showNotification(`Editing teacher: ${teacherId}`, 'warning');
    }

    setupTeacherQuickActions() {
        // Teacher-specific quick actions
    }

    setupAdminQuickActions() {
        // Admin-specific quick actions
    }

    setupParentQuickActions() {
        // Parent-specific quick actions
    }

    populateSchoolAndTeacherDropdowns() {
        // This would populate dropdowns with data from API
    }

    createNoDataCard(type, actionText) {
        const icons = {
            'students': 'fa-users',
            'teachers': 'fa-chalkboard-teacher',
            'parents': 'fa-user-friends',
            'schools': 'fa-school'
        };
        
        return `
            <div class="no-data" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <i class="fas ${icons[type] || 'fa-folder'} fa-3x" style="color: #ddd; margin-bottom: 1rem;"></i>
                <h3>No ${type.charAt(0).toUpperCase() + type.slice(1)} Found</h3>
                <p>Get started by adding your first ${type.slice(0, -1)}.</p>
                <button class="btn btn-primary" onclick="system.showModal('add${type.charAt(0).toUpperCase() + type.slice(1, -1)}Modal')">
                    <i class="fas fa-plus"></i> ${actionText}
                </button>
            </div>
        `;
    }

    renderSystemLogs(logs) {
        const container = document.getElementById('systemActivity');
        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = '<div class="activity-item">No system activity yet</div>';
            return;
        }

        container.innerHTML = '';
        logs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <strong>${log.action}</strong>
                <span>${log.user ? `By: ${log.user}` : ''}</span>
                <small>${this.formatDate(log.timestamp)}</small>
            `;
            container.appendChild(item);
        });
    }

    renderParentStudents(students) {
        const container = document.getElementById('parentStudents');
        if (!container) return;

        if (students.length === 0) {
            container.innerHTML = this.createNoDataCard('students', 'Add Child');
            return;
        }

        container.innerHTML = '';
        students.forEach(student => {
            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <h4>${student.name}</h4>
                <div class="student-info">
                    <p><strong><i class="fas fa-school"></i> School:</strong> ${student.school || 'Not specified'}</p>
                    <p><strong><i class="fas fa-chart-line"></i> Progress:</strong> 
                        <span class="status-badge ${student.forms?.progress?.status === 'completed' ? 'status-active' : 'status-pending'}">
                            ${student.forms?.progress?.status || 'Pending'}
                        </span>
                    </p>
                    <p><strong><i class="fas fa-sticky-note"></i> Notes:</strong> ${student.notes || 'No notes'}</p>
                </div>
                <div class="student-actions">
                    <button class="btn btn-primary btn-sm" onclick="system.viewStudentProgress('${student.id}')">
                        <i class="fas fa-chart-line"></i> View Progress
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="system.contactTeacher('${student.assignedTeacher}')">
                        <i class="fas fa-envelope"></i> Message Teacher
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    async loadParentMeetings() {
        // Demo meetings data
        const meetings = [
            {
                id: 'M001',
                type: 'Case Conference',
                date: '2024-11-20',
                time: '10:00 AM',
                status: 'scheduled',
                student: 'Emma Wilson'
            }
        ];
        
        this.renderParentMeetings(meetings);
    }

    renderParentMeetings(meetings) {
        const container = document.getElementById('parentMeetings') || 
                         document.getElementById('parentMeetingsList');
        if (!container) return;

        container.innerHTML = '';
        meetings.forEach(meeting => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <strong>${meeting.type}</strong>
                <span>${meeting.student} • ${meeting.date} at ${meeting.time}</span>
                <small><span class="status-badge status-${meeting.status}">${meeting.status}</span></small>
            `;
            container.appendChild(item);
        });
    }

    async loadParentDocuments() {
        // Demo documents data
        const documents = [
            {
                id: 'DOC001',
                name: 'Progress Report - Q3 2024',
                type: 'Progress Report',
                date: '2024-10-15',
                student: 'Emma Wilson'
            }
        ];
        
        this.renderParentDocuments(documents);
    }

    renderParentDocuments(documents) {
        const container = document.getElementById('parentDocuments');
        if (!container) return;

        container.innerHTML = '';
        documents.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <strong>${doc.name}</strong>
                <span>${doc.type} • ${doc.student}</span>
                <small>${this.formatDate(doc.date)}</small>
            `;
            container.appendChild(item);
        });
    }

    viewStudentProgress(studentId) {
        this.showNotification(`Viewing progress for student: ${studentId}`, 'info');
    }

    contactTeacher(teacherId) {
        this.showNotification(`Contacting teacher: ${teacherId}`, 'info');
    }

    // ==================== INITIALIZATION ====================

    // Add CSS for animations
    addAnimationStyles() {
        if (!document.querySelector('#system-animations')) {
            const style = document.createElement('style');
            style.id = 'system-animations';
            style.textContent = `
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                
                @keyframes ripple-animation {
                    to {
                        transform: scale(4);
                        opacity: 0;
                    }
                }
                
                .focused {
                    position: relative;
                }
                
                .focused::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    border: 2px solid var(--primary-color);
                    border-radius: 8px;
                    animation: pulse 2s infinite;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Initialize the system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.system = new CaseConferenceSystem();
    window.system.addAnimationStyles();
});