class AuthManager {
    constructor() {
        this.apiBase = '/api';
        this.currentForm = 'login';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Form switch links
        const showRegisterLink = document.getElementById('show-register-link');
        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegister();
            });
        }

        const showLoginLink = document.getElementById('show-login-link');
        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLogin();
            });
        }
    }

    async checkExistingAuth() {
        const token = localStorage.getItem('timeTracker_token');
        if (token) {
            try {
                const response = await fetch(`${this.apiBase}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    // User is already logged in, redirect to main app
                    window.location.href = '/';
                    return;
                }
            } catch (error) {
                console.log('No valid existing session');
            }
            
            // Remove invalid token
            localStorage.removeItem('timeTracker_token');
            localStorage.removeItem('timeTracker_user');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const usernameOrEmail = document.getElementById('loginUsernameOrEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!usernameOrEmail || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    usernameOrEmail,
                    password
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth data
                localStorage.setItem('timeTracker_token', data.token);
                localStorage.setItem('timeTracker_user', JSON.stringify(data.user));
                
                // Redirect to main app
                window.location.href = '/';
            } else {
                this.showError(data.error || 'Login failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        // Validation
        if (!username || !email || !password || !confirmPassword) {
            this.showError('Please fill in all fields');
            return;
        }

        if (username.length < 3) {
            this.showError('Username must be at least 3 characters long');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const response = await fetch(`${this.apiBase}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    email,
                    password
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth data
                localStorage.setItem('timeTracker_token', data.token);
                localStorage.setItem('timeTracker_user', JSON.stringify(data.user));
                
                // Show success message and redirect
                this.showSuccess('Account created successfully! Redirecting...');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                this.showError(data.error || 'Registration failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    showLogin() {
        this.currentForm = 'login';
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        this.hideError();
    }

    showRegister() {
        this.currentForm = 'register';
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        this.hideError();
    }

    showLoading(show) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const loading = document.getElementById('auth-loading');

        if (show) {
            loginForm.classList.add('hidden');
            registerForm.classList.add('hidden');
            loading.classList.remove('hidden');
        } else {
            if (this.currentForm === 'login') {
                loginForm.classList.remove('hidden');
            } else {
                registerForm.classList.remove('hidden');
            }
            loading.classList.add('hidden');
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('auth-error');
        const errorText = document.getElementById('error-text');
        
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    showSuccess(message) {
        // Create a success message element
        const errorDiv = document.getElementById('auth-error');
        const errorText = document.getElementById('error-text');
        
        // Temporarily use error div for success message
        errorDiv.style.background = '#f0fdf4';
        errorDiv.style.color = '#059669';
        errorDiv.style.borderColor = 'rgba(5, 150, 105, 0.2)';
        
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    hideError() {
        const errorDiv = document.getElementById('auth-error');
        errorDiv.classList.add('hidden');
        
        // Reset styles if they were changed for success message
        errorDiv.style.background = '';
        errorDiv.style.color = '';
        errorDiv.style.borderColor = '';
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});