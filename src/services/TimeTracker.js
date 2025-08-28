const TimeEntry = require('../models/TimeEntry');
const Task = require('../models/Task');
const DailyLog = require('../models/DailyLog');

class TimeTracker {
    constructor() {
        this.activeTimeEntries = new Map(); // taskId -> TimeEntry
        this.onTimeUpdate = null; // callback for time updates
    }

    startTracking(taskId, description = '') {
        // Stop ALL existing tracking (only one active session allowed)
        this.stopAllTracking();

        const timeEntry = new TimeEntry({
            taskId,
            description,
            startTime: new Date().toISOString()
        });

        this.activeTimeEntries.set(taskId, timeEntry);
        
        // Start the timer update interval
        this.startTimer(taskId);
        
        return timeEntry;
    }

    pauseTracking(taskId) {
        const timeEntry = this.activeTimeEntries.get(taskId);
        if (timeEntry && timeEntry.isActive()) {
            timeEntry.pause();
            this.stopTimer(taskId);
            return timeEntry;
        }
        return null;
    }

    resumeTracking(taskId) {
        const timeEntry = this.activeTimeEntries.get(taskId);
        if (timeEntry && timeEntry.isPaused) {
            timeEntry.resume();
            this.startTimer(taskId);
            return timeEntry;
        }
        return null;
    }

    stopTracking(taskId) {
        const timeEntry = this.activeTimeEntries.get(taskId);
        if (timeEntry) {
            timeEntry.stop();
            this.stopTimer(taskId);
            this.activeTimeEntries.delete(taskId);
            
            // Trigger callback if set
            if (this.onTimeUpdate) {
                this.onTimeUpdate(taskId, timeEntry.duration);
            }
            
            return timeEntry;
        }
        return null;
    }

    getActiveEntry(taskId) {
        return this.activeTimeEntries.get(taskId);
    }

    getAllActiveEntries() {
        return Array.from(this.activeTimeEntries.values()).map(entry => entry.toJSON());
    }

    isTracking(taskId) {
        const entry = this.activeTimeEntries.get(taskId);
        return entry ? entry.isActive() : false;
    }

    isPaused(taskId) {
        const entry = this.activeTimeEntries.get(taskId);
        return entry ? entry.isPaused : false;
    }

    getCurrentDuration(taskId) {
        const entry = this.activeTimeEntries.get(taskId);
        return entry ? entry.getCurrentDuration() : 0;
    }

    stopAllTracking() {
        const stoppedEntries = [];
        for (const [taskId, entry] of this.activeTimeEntries) {
            entry.stop();
            this.stopTimer(taskId);
            stoppedEntries.push(entry);
            
            // Trigger callback for each stopped entry
            if (this.onTimeUpdate) {
                this.onTimeUpdate(taskId, entry.duration);
            }
        }
        this.activeTimeEntries.clear();
        return stoppedEntries;
    }

    getActiveTaskId() {
        for (const [taskId, entry] of this.activeTimeEntries) {
            if (entry.isActive()) {
                return taskId;
            }
        }
        return null;
    }

    startTimer(taskId) {
        // Clear any existing timer
        this.stopTimer(taskId);
        
        // Set up interval to update duration every minute
        const interval = setInterval(() => {
            const entry = this.activeTimeEntries.get(taskId);
            if (!entry || !entry.isActive()) {
                clearInterval(interval);
                return;
            }
            
            // Trigger update callback if set
            if (this.onTimeUpdate) {
                this.onTimeUpdate(taskId, entry.getCurrentDuration());
            }
        }, 60000); // Update every minute
        
        // Store interval reference
        if (!this.timers) {
            this.timers = new Map();
        }
        this.timers.set(taskId, interval);
    }

    stopTimer(taskId) {
        if (this.timers && this.timers.has(taskId)) {
            clearInterval(this.timers.get(taskId));
            this.timers.delete(taskId);
        }
    }

    // Set callback for time updates
    setTimeUpdateCallback(callback) {
        this.onTimeUpdate = callback;
    }

    // Get summary for a specific date
    getDaySummary(date) {
        // This would typically query the database
        // For now, return current active entries if date is today
        const today = new Date().toISOString().split('T')[0];
        if (date === today) {
            return {
                date,
                activeEntries: this.getAllActiveEntries(),
                totalActiveTime: Array.from(this.activeTimeEntries.values())
                    .reduce((total, entry) => total + entry.getCurrentDuration(), 0)
            };
        }
        return { date, activeEntries: [], totalActiveTime: 0 };
    }
}

module.exports = TimeTracker;