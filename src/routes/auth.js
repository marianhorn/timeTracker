const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: { error: 'Too many authentication attempts, please try again later' },
    skipSuccessfulRequests: true
});

// POST /api/auth/register - Register new user
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        const authService = req.app.locals.authService;
        const result = await authService.register(username, email, password);
        
        res.status(201).json({
            message: 'User registered successfully',
            user: result.user,
            token: result.token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/login - Login user
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;
        
        if (!usernameOrEmail || !password) {
            return res.status(400).json({ error: 'Username/email and password are required' });
        }

        const authService = req.app.locals.authService;
        const result = await authService.login(usernameOrEmail, password);
        
        res.json({
            message: 'Login successful',
            user: result.user,
            token: result.token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
});

// GET /api/auth/me - Get current user info
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const authService = req.app.locals.authService;
        const user = await authService.verifyToken(token);
        
        res.json({ user: user.toSafeJSON() });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// POST /api/auth/logout - Logout user (client-side token removal)
router.post('/logout', (req, res) => {
    // JWT tokens are stateless, so logout is handled client-side
    // This endpoint exists for consistency and future session management
    res.json({ message: 'Logout successful' });
});

module.exports = router;