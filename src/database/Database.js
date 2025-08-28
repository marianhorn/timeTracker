const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor(dbPath = './data/timetracker.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.ensureDataDirectory();
    }

    ensureDataDirectory() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.initializeTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async initializeTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                parent_id TEXT,
                category TEXT DEFAULT 'general',
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'todo',
                estimated_time INTEGER,
                actual_time INTEGER DEFAULT 0,
                deadline TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                tags TEXT,
                FOREIGN KEY (parent_id) REFERENCES tasks (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS time_entries (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                duration INTEGER DEFAULT 0,
                description TEXT,
                date TEXT NOT NULL,
                is_paused BOOLEAN DEFAULT FALSE,
                paused_duration INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS daily_logs (
                id TEXT PRIMARY KEY,
                date TEXT UNIQUE NOT NULL,
                total_time INTEGER DEFAULT 0,
                tasks_completed TEXT,
                tasks_worked_on TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`
        ];

        for (const query of queries) {
            await this.run(query);
        }
    }

    run(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Task operations
    async createTask(task) {
        const query = `INSERT INTO tasks 
            (id, title, description, parent_id, category, priority, status, 
             estimated_time, actual_time, deadline, created_at, updated_at, completed_at, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const params = [
            task.id, task.title, task.description, task.parentId, task.category,
            task.priority, task.status, task.estimatedTime, task.actualTime, task.deadline,
            task.createdAt, task.updatedAt, task.completedAt, JSON.stringify(task.tags)
        ];
        
        return await this.run(query, params);
    }

    async updateTask(task) {
        const query = `UPDATE tasks SET 
            title = ?, description = ?, category = ?, priority = ?, status = ?,
            estimated_time = ?, actual_time = ?, deadline = ?, updated_at = ?, completed_at = ?, tags = ?
            WHERE id = ?`;
        
        const params = [
            task.title, task.description, task.category, task.priority, task.status,
            task.estimatedTime, task.actualTime, task.deadline, task.updatedAt, task.completedAt,
            JSON.stringify(task.tags), task.id
        ];
        
        return await this.run(query, params);
    }

    async getTask(id) {
        const query = `SELECT * FROM tasks WHERE id = ?`;
        const row = await this.get(query, [id]);
        return row ? this.rowToTask(row) : null;
    }

    async getTasks(parentId = null) {
        const query = parentId 
            ? `SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at`
            : `SELECT * FROM tasks WHERE parent_id IS NULL ORDER BY created_at`;
        const params = parentId ? [parentId] : [];
        const rows = await this.all(query, params);
        return rows.map(row => this.rowToTask(row));
    }

    async deleteTask(id) {
        // First delete all child tasks
        await this.run(`DELETE FROM tasks WHERE parent_id = ?`, [id]);
        // Then delete the task itself
        return await this.run(`DELETE FROM tasks WHERE id = ?`, [id]);
    }

    rowToTask(row) {
        return {
            id: row.id,
            title: row.title,
            description: row.description,
            parentId: row.parent_id,
            category: row.category,
            priority: row.priority,
            status: row.status,
            estimatedTime: row.estimated_time,
            actualTime: row.actual_time,
            deadline: row.deadline,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            completedAt: row.completed_at,
            tags: row.tags ? JSON.parse(row.tags) : []
        };
    }

    // Time entry operations
    async createTimeEntry(entry) {
        const query = `INSERT INTO time_entries 
            (id, task_id, start_time, end_time, duration, description, date, 
             is_paused, paused_duration, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const params = [
            entry.id, entry.taskId, entry.startTime, entry.endTime, entry.duration,
            entry.description, entry.date, entry.isPaused, entry.pausedDuration,
            entry.createdAt, entry.updatedAt
        ];
        
        return await this.run(query, params);
    }

    async getTimeEntriesByTask(taskId) {
        const query = `SELECT * FROM time_entries WHERE task_id = ? ORDER BY start_time DESC`;
        return await this.all(query, [taskId]);
    }

    async getTimeEntriesByDate(date) {
        const query = `SELECT * FROM time_entries WHERE date = ? ORDER BY start_time`;
        return await this.all(query, [date]);
    }

    // Daily log operations
    async createOrUpdateDailyLog(log) {
        const existing = await this.get(`SELECT id FROM daily_logs WHERE date = ?`, [log.date]);
        
        if (existing) {
            const query = `UPDATE daily_logs SET 
                total_time = ?, tasks_completed = ?, tasks_worked_on = ?, 
                notes = ?, updated_at = ? WHERE date = ?`;
            const params = [
                log.totalTime, JSON.stringify(log.tasksCompleted), 
                JSON.stringify(log.tasksWorkedOn), log.notes, log.updatedAt, log.date
            ];
            return await this.run(query, params);
        } else {
            const query = `INSERT INTO daily_logs 
                (id, date, total_time, tasks_completed, tasks_worked_on, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            const params = [
                log.id, log.date, log.totalTime, JSON.stringify(log.tasksCompleted),
                JSON.stringify(log.tasksWorkedOn), log.notes, log.createdAt, log.updatedAt
            ];
            return await this.run(query, params);
        }
    }

    async getDailyLog(date) {
        const query = `SELECT * FROM daily_logs WHERE date = ?`;
        const row = await this.get(query, [date]);
        if (!row) return null;
        
        return {
            id: row.id,
            date: row.date,
            totalTime: row.total_time,
            tasksCompleted: row.tasks_completed ? JSON.parse(row.tasks_completed) : [],
            tasksWorkedOn: row.tasks_worked_on ? JSON.parse(row.tasks_worked_on) : [],
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

module.exports = Database;