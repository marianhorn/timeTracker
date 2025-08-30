const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const Database = require('./database/Database');
const TimeTracker = require('./services/TimeTracker');
const TaskService = require('./services/TaskService');
const AuthService = require('./services/AuthService');

// Import routes
const authRouter = require('./routes/auth');
const tasksRouter = require('./routes/tasks');
const logsRouter = require('./routes/logs');
const analyticsRouter = require('./routes/analytics');
const categoriesRouter = require('./routes/categories');

// Import middleware
const { authenticateAndSwitchDB } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - conditional based on environment
if (process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true') {
    // Full security headers for HTTPS production
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            },
        },
    }));
} else {
    // Minimal security headers for HTTP/development
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: false,
        crossOriginEmbedderPolicy: false,
        originAgentCluster: false,
    }));
}

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: { error: 'Too many requests, please try again later' }
});

app.use(generalLimiter);

// Basic middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

async function initializeApp() {
    try {
        // Initialize main database (for users and authentication)
        const mainDatabase = new Database();
        await mainDatabase.connect();

        // Initialize user database handler (for switching user databases)
        const userDatabase = new Database();
        await userDatabase.connect();

        // Initialize authentication service with main database (never switches)
        const authService = new AuthService(mainDatabase);

        // Make services available to routes
        app.locals.database = userDatabase;  // This one switches for user operations
        app.locals.mainDatabase = mainDatabase;  // This one stays on main DB
        app.locals.authService = authService;

        // Public routes (no authentication required)
        app.use('/api/auth', authRouter);

        // Protected routes (require authentication and user database switching)
        app.use('/api/tasks', authenticateAndSwitchDB, (req, res, next) => {
            // Use user-specific services
            req.app.locals.taskService = req.userServices.taskService;
            req.app.locals.timeTracker = req.userServices.timeTracker;
            next();
        }, tasksRouter);
        
        app.use('/api/logs', authenticateAndSwitchDB, (req, res, next) => {
            req.app.locals.taskService = req.userServices.taskService;
            next();
        }, logsRouter);
        
        app.use('/api/analytics', authenticateAndSwitchDB, (req, res, next) => {
            req.app.locals.taskService = req.userServices.taskService;
            next();
        }, analyticsRouter);
        
        app.use('/api/categories', authenticateAndSwitchDB, (req, res, next) => {
            req.app.locals.taskService = req.userServices.taskService;
            next();
        }, categoriesRouter);

        // Health check endpoint
        app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                usersCount: 'protected' // Don't expose user count for security
            });
        });

        // Serve login page for unauthenticated users
        app.get('/login', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/login.html'));
        });

        // Redirect root to login page (will be handled by frontend)
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // Serve frontend for all other routes
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // Error handling middleware
        app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);
            res.status(500).json({ 
                error: 'Internal server error', 
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\nShutting down gracefully...');
            
            // Stop all active time tracking
            const stoppedEntries = timeTracker.stopAllTracking();
            console.log(`Stopped ${stoppedEntries.length} active time entries`);
            
            // Save stopped entries to database
            for (const entry of stoppedEntries) {
                await database.createTimeEntry(entry);
                
                // Update task time
                const task = await database.getTask(entry.taskId);
                if (task) {
                    task.actualTime = (task.actualTime || 0) + entry.duration;
                    task.updatedAt = new Date().toISOString();
                    await database.updateTask(task);
                }
            }
            
            // Close database connection
            await database.close();
            console.log('Database connection closed');
            
            process.exit(0);
        });

        // Start server
        app.listen(PORT, () => {
            console.log(`Time Tracker Server running on port ${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
            console.log(`Web interface at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Failed to initialize app:', error);
        process.exit(1);
    }
}

// Initialize the application
initializeApp();

module.exports = app;