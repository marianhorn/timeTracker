const express = require('express');
const router = express.Router();

// GET /api/analytics/active - Get currently active time entries
router.get('/active', async (req, res) => {
    try {
        const activeEntries = await req.app.locals.taskService.getActiveTimeEntries();
        res.json(activeEntries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/productivity/:startDate/:endDate - Get productivity stats
router.get('/productivity/:startDate/:endDate', async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        const stats = await req.app.locals.taskService.getProductivityStats(startDate, endDate);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/hierarchy - Get full task hierarchy
router.get('/hierarchy', async (req, res) => {
    try {
        const hierarchy = await req.app.locals.taskService.getTaskHierarchy();
        res.json(hierarchy.map(task => task.toJSON()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/summary - Get overall summary
router.get('/summary', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const todayLog = await req.app.locals.taskService.getDailyLog(today);
        const weekStats = await req.app.locals.taskService.getProductivityStats(weekAgo, today);
        const allTasks = await req.app.locals.taskService.getTasks();
        const activeEntries = await req.app.locals.taskService.getActiveTimeEntries();
        
        const summary = {
            today: {
                time: todayLog.totalTime,
                tasksCompleted: todayLog.tasksCompleted.length,
                tasksWorkedOn: todayLog.tasksWorkedOn.length,
                productivityScore: todayLog.getProductivityScore()
            },
            week: {
                totalTime: weekStats.totalTime,
                tasksCompleted: weekStats.tasksCompleted,
                averageProductivity: weekStats.productivityScores.length > 0 
                    ? weekStats.productivityScores.reduce((sum, s) => sum + s.score, 0) / weekStats.productivityScores.length 
                    : 0,
                categoryBreakdown: weekStats.categoryBreakdown
            },
            overall: {
                totalTasks: allTasks.length,
                completedTasks: allTasks.filter(t => t.status === 'completed').length,
                inProgressTasks: allTasks.filter(t => t.status === 'in_progress').length,
                activeTracking: activeEntries.length
            }
        };
        
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/time-trends/:days - Get time trends for last N days
router.get('/time-trends/:days', async (req, res) => {
    try {
        const days = parseInt(req.params.days) || 7;
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const stats = await req.app.locals.taskService.getProductivityStats(startDate, endDate);
        
        const trends = {
            timeByDay: stats.dailyBreakdown,
            productivityScores: stats.productivityScores,
            categoryBreakdown: stats.categoryBreakdown,
            totalTime: stats.totalTime,
            totalTasks: stats.tasksCompleted,
            averageTimePerDay: stats.totalTime / days,
            averageTasksPerDay: stats.tasksCompleted / days
        };
        
        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/deadlines - Get deadline overview
router.get('/deadlines', async (req, res) => {
    try {
        const [overdue, dueTomorrow, dueThisWeek] = await Promise.all([
            req.app.locals.taskService.getOverdueTasks(),
            req.app.locals.taskService.getTasksDueTomorrow(),
            req.app.locals.taskService.getTasksDueThisWeek()
        ]);
        
        res.json({
            overdue: overdue.map(task => task.toJSON()),
            dueTomorrow: dueTomorrow.map(task => task.toJSON()),
            dueThisWeek: dueThisWeek.map(task => task.toJSON()),
            activeTaskId: await req.app.locals.taskService.getActiveTaskId()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;