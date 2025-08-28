const Task = require('../models/Task');
const DailyLog = require('../models/DailyLog');

class TaskService {
    constructor(database, timeTracker) {
        this.db = database;
        this.timeTracker = timeTracker;
        
        // Set up time tracker callback to update task time
        this.timeTracker.setTimeUpdateCallback(this.handleTimeUpdate.bind(this));
    }

    async createTask(taskData) {
        const task = new Task(taskData);
        await this.db.createTask(task);
        return task;
    }

    async updateTask(id, updates) {
        const existingTask = await this.db.getTask(id);
        if (!existingTask) {
            throw new Error('Task not found');
        }

        const task = new Task({ ...existingTask, ...updates });
        task.updatedAt = new Date().toISOString();
        
        // If status changed to completed, set completion date
        if (updates.status === 'completed' && existingTask.status !== 'completed') {
            task.completedAt = new Date().toISOString();
            await this.logTaskCompletion(task);
        }

        await this.db.updateTask(task);
        return task;
    }

    async getTask(id) {
        const taskData = await this.db.getTask(id);
        if (!taskData) return null;

        const task = new Task(taskData);
        
        // Get children tasks
        const children = await this.db.getTasks(id);
        task.children = children.map(childData => new Task(childData));
        
        return task;
    }

    async getTasks(parentId = null) {
        const tasksData = await this.db.getTasks(parentId);
        const tasks = [];

        for (const taskData of tasksData) {
            const task = new Task(taskData);
            // Get children for each task
            const children = await this.db.getTasks(task.id);
            task.children = children.map(childData => new Task(childData));
            tasks.push(task);
        }

        return tasks;
    }

    async deleteTask(id) {
        // Stop tracking if task is being tracked
        if (this.timeTracker.isTracking(id)) {
            this.timeTracker.stopTracking(id);
        }
        
        return await this.db.deleteTask(id);
    }

    async startTimeTracking(taskId, description = '') {
        const task = await this.db.getTask(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        return this.timeTracker.startTracking(taskId, description);
    }

    async pauseTimeTracking(taskId) {
        return this.timeTracker.pauseTracking(taskId);
    }

    async resumeTimeTracking(taskId) {
        return this.timeTracker.resumeTracking(taskId);
    }

    async stopTimeTracking(taskId) {
        const timeEntry = this.timeTracker.stopTracking(taskId);
        
        if (timeEntry) {
            // Save time entry to database
            await this.db.createTimeEntry(timeEntry);
            
            // Update task's actual time and propagate to parents
            await this.updateTaskTimeAndPropagate(taskId, timeEntry.duration);

            // Get task for daily log
            const task = await this.db.getTask(taskId);
            
            // Update daily log
            await this.updateDailyLog(timeEntry.date, taskId, task.title, timeEntry.duration);
        }

        return timeEntry;
    }

    async updateTaskTimeAndPropagate(taskId, timeSpent) {
        // Update the task's actual time
        const task = await this.db.getTask(taskId);
        if (task) {
            task.actualTime = (task.actualTime || 0) + timeSpent;
            task.updatedAt = new Date().toISOString();
            await this.db.updateTask(new Task(task));

            // If task has a parent, also update parent's time
            if (task.parentId) {
                await this.updateTaskTimeAndPropagate(task.parentId, timeSpent);
            }
        }
    }

    async getActiveTimeEntries() {
        return this.timeTracker.getAllActiveEntries();
    }

    async getTimeEntriesByTask(taskId) {
        return await this.db.getTimeEntriesByTask(taskId);
    }

    async getTasksByCategory(category) {
        const allTasks = await this.getTasks();
        return allTasks.filter(task => task.category === category);
    }

    async getTasksByStatus(status) {
        const allTasks = await this.getTasks();
        return allTasks.filter(task => task.status === status);
    }

    async getDailyLog(date) {
        let log = await this.db.getDailyLog(date);
        if (!log) {
            log = new DailyLog({ date });
            await this.db.createOrUpdateDailyLog(log);
        }
        return new DailyLog(log);
    }

    async updateDailyLog(date, taskId, taskTitle, timeSpent) {
        let log = await this.db.getDailyLog(date);
        if (!log) {
            log = new DailyLog({ date });
        } else {
            log = new DailyLog(log);
        }

        log.addWorkedOnTask(taskId, taskTitle, timeSpent);
        log.addTime(timeSpent);

        await this.db.createOrUpdateDailyLog(log);
        return log;
    }

    async logTaskCompletion(task) {
        const today = new Date().toISOString().split('T')[0];
        let log = await this.db.getDailyLog(today);
        
        if (!log) {
            log = new DailyLog({ date: today });
        } else {
            log = new DailyLog(log);
        }

        log.addCompletedTask(task.id, task.title);
        await this.db.createOrUpdateDailyLog(log);
        return log;
    }

    async handleTimeUpdate(taskId, currentDuration) {
        // This is called periodically while tracking time
        // We could use this to auto-save progress or trigger events
        console.log(`Task ${taskId} has been worked on for ${currentDuration} minutes`);
    }

    async getTaskHierarchy() {
        // Get all root tasks (no parent) and build hierarchy
        const rootTasks = await this.getTasks(null);
        return rootTasks;
    }

    async getTasksDueTomorrow() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const allTasks = await this.getTasks();
        return this.flattenTasks(allTasks).filter(task => 
            task.deadline === tomorrowStr && task.status !== 'completed'
        );
    }

    async getTasksDueThisWeek() {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        const allTasks = await this.getTasks();
        return this.flattenTasks(allTasks).filter(task => {
            if (!task.deadline || task.status === 'completed') return false;
            const taskDate = new Date(task.deadline);
            return taskDate >= today && taskDate <= nextWeek;
        });
    }

    async getOverdueTasks() {
        const today = new Date();
        const allTasks = await this.getTasks();
        return this.flattenTasks(allTasks).filter(task => {
            if (!task.deadline || task.status === 'completed') return false;
            return new Date(task.deadline) < today;
        });
    }

    flattenTasks(tasks) {
        let flattened = [];
        for (const task of tasks) {
            flattened.push(task);
            if (task.children && task.children.length > 0) {
                flattened = flattened.concat(this.flattenTasks(task.children));
            }
        }
        return flattened;
    }

    async getActiveTaskId() {
        return this.timeTracker.getActiveTaskId();
    }

    async getProductivityStats(startDate, endDate) {
        const stats = {
            totalTime: 0,
            tasksCompleted: 0,
            productivityScores: [],
            categoryBreakdown: {},
            dailyBreakdown: []
        };

        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0];
            const log = await this.db.getDailyLog(dateStr);
            
            if (log) {
                const dailyLog = new DailyLog(log);
                stats.totalTime += dailyLog.totalTime;
                stats.tasksCompleted += dailyLog.tasksCompleted.length;
                stats.productivityScores.push({
                    date: dateStr,
                    score: dailyLog.getProductivityScore()
                });
                
                stats.dailyBreakdown.push({
                    date: dateStr,
                    time: dailyLog.totalTime,
                    tasks: dailyLog.tasksCompleted.length
                });

                // Category breakdown
                for (const workedTask of dailyLog.tasksWorkedOn) {
                    const task = await this.db.getTask(workedTask.id);
                    if (task) {
                        const category = task.category || 'general';
                        stats.categoryBreakdown[category] = (stats.categoryBreakdown[category] || 0) + workedTask.timeSpent;
                    }
                }
            }
        }

        return stats;
    }
}

module.exports = TaskService;