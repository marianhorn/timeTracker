const { v4: uuidv4 } = require('uuid');

class TimeEntry {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.taskId = data.taskId;
        this.startTime = data.startTime || new Date().toISOString();
        this.endTime = data.endTime || null;
        this.duration = data.duration || 0; // in minutes
        this.description = data.description || '';
        this.date = data.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        this.isPaused = data.isPaused || false;
        this.pausedDuration = data.pausedDuration || 0; // time spent paused in minutes
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    start() {
        this.startTime = new Date().toISOString();
        this.isPaused = false;
        this.updatedAt = new Date().toISOString();
    }

    pause() {
        if (!this.isPaused && this.startTime && !this.endTime) {
            this.isPaused = true;
            this.updatedAt = new Date().toISOString();
        }
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.updatedAt = new Date().toISOString();
        }
    }

    stop() {
        if (this.startTime && !this.endTime) {
            this.endTime = new Date().toISOString();
            this.isPaused = false;
            this.duration = this.calculateDuration();
            this.updatedAt = new Date().toISOString();
        }
    }

    calculateDuration() {
        if (!this.startTime) return 0;
        
        const start = new Date(this.startTime);
        const end = this.endTime ? new Date(this.endTime) : new Date();
        const totalMinutes = Math.round((end - start) / (1000 * 60));
        
        return Math.max(0, totalMinutes - this.pausedDuration);
    }

    getCurrentDuration() {
        if (!this.startTime) return 0;
        if (this.endTime) return this.duration;
        
        const start = new Date(this.startTime);
        const now = new Date();
        const totalMinutes = Math.round((now - start) / (1000 * 60));
        
        return Math.max(0, totalMinutes - this.pausedDuration);
    }

    isActive() {
        return this.startTime && !this.endTime && !this.isPaused;
    }

    toJSON() {
        return {
            id: this.id,
            taskId: this.taskId,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.endTime ? this.duration : this.getCurrentDuration(),
            description: this.description,
            date: this.date,
            isPaused: this.isPaused,
            pausedDuration: this.pausedDuration,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isActive: this.isActive()
        };
    }
}

module.exports = TimeEntry;