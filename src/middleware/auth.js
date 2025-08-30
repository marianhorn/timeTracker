// Authentication middleware that also handles user database switching
const authenticateAndSwitchDB = async (req, res, next) => {
    try {
        const authService = req.app.locals.authService;
        const database = req.app.locals.database;
        
        // Get token from header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        // Verify token and get user
        const user = await authService.verifyToken(token);
        req.user = user;
        
        // Switch to user's database
        await database.switchToUserDatabase(user.id);
        
        // Create user-specific services with the switched database
        const TimeTracker = require('../services/TimeTracker');
        const TaskService = require('../services/TaskService');
        
        const timeTracker = new TimeTracker(database);
        const taskService = new TaskService(database, timeTracker);
        
        // Make services available to the request
        req.userServices = {
            timeTracker,
            taskService
        };
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

module.exports = {
    authenticateAndSwitchDB
};