const express = require('express');
const XLSX = require('xlsx');
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

// GET /api/analytics/export/tasks - Export tasks to Excel
router.get('/export/tasks', async (req, res) => {
    try {
        const tasks = await req.app.locals.taskService.getAllTasksForExport();
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Prepare data for Excel
        const excelData = tasks.map(task => ({
            'Task ID': task.id,
            'Title': task.title,
            'Description': task.description || '',
            'Category': task.category,
            'Priority': task.priority,
            'Status': task.status,
            'Estimated Time (min)': task.estimatedTime || '',
            'Actual Time (min)': task.actualTime || 0,
            'Total Time (min)': task.totalTime || 0,
            'Deadline': task.deadline || '',
            'Is Overdue': task.isOverdue ? 'Yes' : 'No',
            'Days Until Deadline': task.daysUntilDeadline || '',
            'Parent Task ID': task.parentId || '',
            'Has Subtasks': task.hasSubtasks ? 'Yes' : 'No',
            'Subtask Count': task.subtaskCount || 0,
            'Completed Subtasks': task.completedSubtasks || 0,
            'Progress (%)': task.progress || 0,
            'Created At': task.createdAt,
            'Updated At': task.updatedAt,
            'Completed At': task.completedAt || ''
        }));
        
        // Add worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
        
        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=tasks-export-${new Date().toISOString().split('T')[0]}.xlsx`);
        
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/export/time-entries - Export time entries to Excel
router.get('/export/time-entries', async (req, res) => {
    try {
        const timeEntries = await req.app.locals.taskService.getAllTimeEntries();
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Prepare data for Excel
        const excelData = timeEntries.map(entry => {
            const startDate = new Date(entry.start_time);
            const endDate = entry.end_time ? new Date(entry.end_time) : null;
            
            return {
                'Entry ID': entry.id,
                'Task ID': entry.task_id,
                'Task Title': entry.task_title,
                'Category': entry.category,
                'Date': entry.date,
                'Start Time': startDate.toLocaleString(),
                'End Time': endDate ? endDate.toLocaleString() : 'Not finished',
                'Duration (min)': entry.duration || 0,
                'Description': entry.description || '',
                'Is Paused': entry.is_paused ? 'Yes' : 'No',
                'Paused Duration (min)': entry.paused_duration || 0,
                'Parent Task ID': entry.parent_id || '',
                'Week': `${startDate.getFullYear()}-W${Math.ceil(((startDate - new Date(startDate.getFullYear(), 0, 1)) / 86400000 + 1) / 7)}`,
                'Month': `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
                'Year': startDate.getFullYear()
            };
        });
        
        // Add main worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, 'Time Entries');
        
        // Add summary by day
        const dailySummary = {};
        excelData.forEach(entry => {
            const date = entry.Date;
            if (!dailySummary[date]) {
                dailySummary[date] = { date, totalTime: 0, entries: 0, categories: new Set() };
            }
            dailySummary[date].totalTime += entry['Duration (min)'];
            dailySummary[date].entries += 1;
            dailySummary[date].categories.add(entry.Category);
        });
        
        const dailyData = Object.values(dailySummary).map(day => ({
            'Date': day.date,
            'Total Time (min)': day.totalTime,
            'Total Time (hours)': Math.round(day.totalTime / 60 * 100) / 100,
            'Number of Entries': day.entries,
            'Categories Worked': Array.from(day.categories).join(', ')
        }));
        
        const wsDaily = XLSX.utils.json_to_sheet(dailyData);
        XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Summary');
        
        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=time-entries-export-${new Date().toISOString().split('T')[0]}.xlsx`);
        
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Enhanced time-trends endpoint with flexible parameters
router.get('/time-trends-enhanced', async (req, res) => {
    try {
        const { period = 'day', duration = 'week' } = req.query;
        let startDate, endDate;
        
        endDate = new Date().toISOString().split('T')[0];
        
        switch (duration) {
            case 'week':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                break;
            case 'month':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                break;
            case 'year':
                startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                break;
            case 'all':
                const allTasks = await req.app.locals.taskService.getTasks();
                if (allTasks.length > 0) {
                    const dates = allTasks.map(t => new Date(t.createdAt));
                    startDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
                } else {
                    startDate = endDate;
                }
                break;
            default:
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
        
        const stats = await req.app.locals.taskService.getProductivityStats(startDate, endDate, period);
        
        const trends = {
            period: period,
            duration: duration,
            startDate: startDate,
            endDate: endDate,
            timeByPeriod: stats.productivityScores,
            categoryBreakdown: stats.categoryBreakdown,
            totalTime: stats.totalTime,
            totalTasks: stats.tasksCompleted,
            dailyData: stats.dailyBreakdown
        };
        
        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;