const { v4: uuidv4 } = require('uuid');

class Task {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.title = data.title || '';
        this.description = data.description || '';
        this.parentId = data.parentId || null;
        this.category = data.category || 'general'; // literature, writing, research, etc.
        this.priority = data.priority || 'medium'; // low, medium, high
        this.status = data.status || 'todo'; // todo, in_progress, completed
        this.estimatedTime = data.estimatedTime || null; // in minutes
        this.actualTime = data.actualTime || 0; // in minutes
        this.deadline = data.deadline || null; // ISO date string
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.completedAt = data.completedAt || null;
        this.tags = data.tags || [];
        this.children = [];
    }

    addChild(childTask) {
        childTask.parentId = this.id;
        this.children.push(childTask);
    }

    removeChild(childId) {
        this.children = this.children.filter(child => child.id !== childId);
    }

    updateStatus(newStatus) {
        this.status = newStatus;
        this.updatedAt = new Date().toISOString();
        if (newStatus === 'completed') {
            this.completedAt = new Date().toISOString();
        }
    }

    addTime(minutes) {
        this.actualTime += minutes;
        this.updatedAt = new Date().toISOString();
    }

    getProgress() {
        if (this.children.length === 0) {
            return this.status === 'completed' ? 100 : 0;
        }
        
        const completedChildren = this.children.filter(child => child.status === 'completed').length;
        return Math.round((completedChildren / this.children.length) * 100);
    }

    getTotalTime() {
        let total = this.actualTime;
        for (const child of this.children) {
            total += child.getTotalTime();
        }
        return total;
    }

    getDaysUntilDeadline() {
        if (!this.deadline) return null;
        const today = new Date();
        const deadline = new Date(this.deadline);
        const diffTime = deadline - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    isOverdue() {
        if (!this.deadline || this.status === 'completed') return false;
        return new Date() > new Date(this.deadline);
    }

    isDueSoon(days = 7) {
        const daysUntil = this.getDaysUntilDeadline();
        return daysUntil !== null && daysUntil >= 0 && daysUntil <= days;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            parentId: this.parentId,
            category: this.category,
            priority: this.priority,
            status: this.status,
            estimatedTime: this.estimatedTime,
            actualTime: this.actualTime,
            deadline: this.deadline,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            completedAt: this.completedAt,
            tags: this.tags,
            children: this.children.map(child => child.toJSON()),
            progress: this.getProgress(),
            totalTime: this.getTotalTime(),
            daysUntilDeadline: this.getDaysUntilDeadline(),
            isOverdue: this.isOverdue(),
            isDueSoon: this.isDueSoon()
        };
    }
}

module.exports = Task;