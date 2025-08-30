const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthService {
    constructor(database) {
        this.db = database;
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    }

    async register(username, email, password) {
        // Check if user already exists
        const existingUser = await this.getUserByUsernameOrEmail(username, email);
        if (existingUser) {
            throw new Error('User already exists with this username or email');
        }

        // Validate input
        if (!username || username.length < 3) {
            throw new Error('Username must be at least 3 characters long');
        }
        
        if (!email || !this.isValidEmail(email)) {
            throw new Error('Please provide a valid email address');
        }
        
        if (!password || password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }

        // Create new user
        const passwordHash = await User.hashPassword(password);
        const user = new User({
            username,
            email,
            passwordHash
        });

        await this.db.createUser(user);
        
        // Create user's database
        await this.db.initializeUserDatabase(user.id);

        return {
            user: user.toSafeJSON(),
            token: this.generateToken(user.id)
        };
    }

    async login(usernameOrEmail, password) {
        const user = await this.getUserByUsernameOrEmail(usernameOrEmail, usernameOrEmail);
        
        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.isActive) {
            throw new Error('Account is deactivated');
        }

        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        user.lastLoginAt = new Date().toISOString();
        await this.db.updateUser(user);

        return {
            user: user.toSafeJSON(),
            token: this.generateToken(user.id)
        };
    }

    generateToken(userId) {
        return jwt.sign(
            { userId },
            this.jwtSecret,
            { expiresIn: this.jwtExpiresIn }
        );
    }

    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            const user = await this.db.getUser(decoded.userId);
            
            if (!user || !user.isActive) {
                throw new Error('Invalid token');
            }
            
            return user;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    async getUserByUsernameOrEmail(username, email) {
        try {
            return await this.db.getUserByUsernameOrEmail(username, email);
        } catch (error) {
            return null;
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Middleware for protecting routes
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        this.verifyToken(token)
            .then(user => {
                req.user = user;
                next();
            })
            .catch(() => {
                res.status(403).json({ error: 'Invalid or expired token' });
            });
    }
}

module.exports = AuthService;