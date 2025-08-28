const { v4: uuidv4 } = require('uuid');

class DailyLog {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.date = data.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        this.totalTime = data.totalTime || 0; // total minutes worked
        this.tasksCompleted = data.tasksCompleted || [];
        this.tasksWorkedOn = data.tasksWorkedOn || [];
        this.notes = data.notes || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    addCompletedTask(taskId, taskTitle) {
        if (!this.tasksCompleted.find(t => t.id === taskId)) {
            this.tasksCompleted.push({ id: taskId, title: taskTitle });
            this.updatedAt = new Date().toISOString();
        }
    }

    addWorkedOnTask(taskId, taskTitle, timeSpent) {
        const existingTask = this.tasksWorkedOn.find(t => t.id === taskId);
        if (existingTask) {
            existingTask.timeSpent += timeSpent;
        } else {
            this.tasksWorkedOn.push({ id: taskId, title: taskTitle, timeSpent });
        }
        this.updatedAt = new Date().toISOString();
    }

    addTime(minutes) {
        this.totalTime += minutes;
        this.updatedAt = new Date().toISOString();
    }

    updateNotes(notes) {
        this.notes = notes;
        this.updatedAt = new Date().toISOString();
    }

    getProductivityScore() {
        // Simple productivity score based on tasks completed and time worked
        const completedWeight = this.tasksCompleted.length * 10;
        const timeWeight = Math.min(this.totalTime / 60, 8) * 5; // Max 8 hours = 5 points
        return Math.round(completedWeight + timeWeight);
    }

    toJSON() {
        return {
            id: this.id,
            date: this.date,
            totalTime: this.totalTime,
            tasksCompleted: this.tasksCompleted,
            tasksWorkedOn: this.tasksWorkedOn,
            notes: this.notes,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            productivityScore: this.getProductivityScore()
        };
    }
}

module.exports = DailyLog;