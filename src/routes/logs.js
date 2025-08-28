const express = require('express');
const router = express.Router();

// GET /api/logs/:date - Get daily log for specific date
router.get('/:date', async (req, res) => {
    try {
        const log = await req.app.locals.taskService.getDailyLog(req.params.date);
        res.json(log.toJSON());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/logs/:date/notes - Update daily log notes
router.put('/:date/notes', async (req, res) => {
    try {
        const { notes } = req.body;
        const log = await req.app.locals.taskService.getDailyLog(req.params.date);
        log.updateNotes(notes);
        
        // Save to database
        await req.app.locals.database.createOrUpdateDailyLog(log);
        res.json(log.toJSON());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/logs/range/:startDate/:endDate - Get logs for date range
router.get('/range/:startDate/:endDate', async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        const logs = [];
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0];
            const log = await req.app.locals.taskService.getDailyLog(dateStr);
            logs.push(log.toJSON());
        }
        
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;