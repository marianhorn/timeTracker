const express = require('express');
const cors = require('cors');
const path = require('path');

const Database = require('./database/Database');
const TimeTracker = require('./services/TimeTracker');
const TaskService = require('./services/TaskService');

// Import routes
const tasksRouter = require('./routes/tasks');
const logsRouter = require('./routes/logs');
const analyticsRouter = require('./routes/analytics');
const categoriesRouter = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

async function initializeApp() {
    try {
        // Initialize database
        const database = new Database();
        await database.connect();

        // Initialize services
        const timeTracker = new TimeTracker();
        const taskService = new TaskService(database, timeTracker);

        // Make services available to routes
        app.locals.database = database;
        app.locals.timeTracker = timeTracker;
        app.locals.taskService = taskService;

        // Routes
        app.use('/api/tasks', tasksRouter);
        app.use('/api/logs', logsRouter);
        app.use('/api/analytics', analyticsRouter);
        app.use('/api/categories', categoriesRouter);

        // Health check endpoint
        app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                activeTracking: timeTracker.getAllActiveEntries().length
            });
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