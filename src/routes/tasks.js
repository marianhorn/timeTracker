const express = require('express');
const router = express.Router();

// GET /api/tasks - Get all tasks (with optional parent filter)
router.get('/', async (req, res) => {
    try {
        const { parentId } = req.query;
        const tasks = await req.app.locals.taskService.getTasks(parentId || null);
        res.json(tasks.map(task => task.toJSON()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tasks/:id - Get specific task
router.get('/:id', async (req, res) => {
    try {
        const task = await req.app.locals.taskService.getTask(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task.toJSON());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/tasks - Create new task
router.post('/', async (req, res) => {
    try {
        const task = await req.app.locals.taskService.createTask(req.body);
        res.status(201).json(task.toJSON());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', async (req, res) => {
    try {
        const task = await req.app.locals.taskService.updateTask(req.params.id, req.body);
        res.json(task.toJSON());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req, res) => {
    try {
        await req.app.locals.taskService.deleteTask(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/tasks/:id/start - Start time tracking
router.post('/:id/start', async (req, res) => {
    try {
        const { description } = req.body;
        const timeEntry = await req.app.locals.taskService.startTimeTracking(req.params.id, description);
        res.json(timeEntry.toJSON());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/tasks/:id/pause - Pause time tracking
router.post('/:id/pause', async (req, res) => {
    try {
        const timeEntry = await req.app.locals.taskService.pauseTimeTracking(req.params.id);
        if (!timeEntry) {
            return res.status(404).json({ error: 'No active time tracking found' });
        }
        res.json(timeEntry.toJSON());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/tasks/:id/resume - Resume time tracking
router.post('/:id/resume', async (req, res) => {
    try {
        const timeEntry = await req.app.locals.taskService.resumeTimeTracking(req.params.id);
        if (!timeEntry) {
            return res.status(404).json({ error: 'No paused time tracking found' });
        }
        res.json(timeEntry.toJSON());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/tasks/:id/stop - Stop time tracking
router.post('/:id/stop', async (req, res) => {
    try {
        const timeEntry = await req.app.locals.taskService.stopTimeTracking(req.params.id);
        if (!timeEntry) {
            return res.status(404).json({ error: 'No active time tracking found' });
        }
        res.json(timeEntry.toJSON());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/tasks/:id/time-entries - Get time entries for task
router.get('/:id/time-entries', async (req, res) => {
    try {
        const entries = await req.app.locals.taskService.getTimeEntriesByTask(req.params.id);
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tasks/category/:category - Get tasks by category
router.get('/category/:category', async (req, res) => {
    try {
        const tasks = await req.app.locals.taskService.getTasksByCategory(req.params.category);
        res.json(tasks.map(task => task.toJSON()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tasks/status/:status - Get tasks by status
router.get('/status/:status', async (req, res) => {
    try {
        const tasks = await req.app.locals.taskService.getTasksByStatus(req.params.status);
        res.json(tasks.map(task => task.toJSON()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;