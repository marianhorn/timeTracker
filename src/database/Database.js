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
        // First create user tables in main database
        await this.initializeUserTables();
        
        // Then create task-related tables (these will be user-specific)
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
            )`,
            
            `CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#3b82f6',
                description TEXT,
                is_default BOOLEAN DEFAULT FALSE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`
        ];

        for (const query of queries) {
            await this.run(query);
        }
        
        // Initialize default categories if none exist
        await this.initializeDefaultCategories();
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

    // User management methods
    async initializeUserTables() {
        const userQueries = [
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login_at TEXT
            )`,
            `CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`,
            `CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`
        ];

        for (const query of userQueries) {
            await this.run(query);
        }

        // Add OAuth columns if they don't exist (migration)
        try {
            await this.run(`ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'local'`);
            await this.run(`ALTER TABLE users ADD COLUMN provider_id TEXT`);
            console.log('Added OAuth columns to users table');
        } catch (error) {
            // Columns already exist, ignore error
        }

        // Make password_hash nullable for OAuth users
        try {
            // SQLite doesn't support ALTER COLUMN directly, so we'll handle this in the application logic
            console.log('OAuth support ready - password_hash can be null for OAuth users');
        } catch (error) {
            // Ignore
        }
    }

    async createUser(user) {
        const query = `
            INSERT INTO users (id, username, email, password_hash, provider, provider_id, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            user.id, user.username, user.email, user.passwordHash,
            user.provider, user.providerId,
            user.isActive ? 1 : 0, user.createdAt, user.updatedAt
        ];
        
        return await this.run(query, params);
    }

    async getUser(userId) {
        const query = `SELECT * FROM users WHERE id = ?`;
        const row = await this.get(query, [userId]);
        return row ? this.rowToUser(row) : null;
    }

    async getUserByUsernameOrEmail(username, email) {
        const query = `SELECT * FROM users WHERE username = ? OR email = ?`;
        const row = await this.get(query, [username, email]);
        return row ? this.rowToUser(row) : null;
    }

    async getUserByEmail(email) {
        const query = `SELECT * FROM users WHERE email = ?`;
        const row = await this.get(query, [email]);
        return row ? this.rowToUser(row) : null;
    }

    async updateUser(user) {
        const query = `
            UPDATE users 
            SET username = ?, email = ?, password_hash = ?, is_active = ?, 
                updated_at = ?, last_login_at = ?
            WHERE id = ?
        `;
        const params = [
            user.username, user.email, user.passwordHash, user.isActive ? 1 : 0,
            user.updatedAt, user.lastLoginAt, user.id
        ];
        
        return await this.run(query, params);
    }

    rowToUser(row) {
        const User = require('../models/User');
        return new User({
            id: row.id,
            username: row.username,
            email: row.email,
            passwordHash: row.password_hash,
            provider: row.provider || 'local',
            providerId: row.provider_id,
            isActive: !!row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastLoginAt: row.last_login_at
        });
    }

    // User-specific database initialization
    async initializeUserDatabase(userId) {
        // Create user-specific data directory
        const userDataDir = `./data/users/${userId}`;
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        // Initialize default categories for the user
        await this.initializeDefaultCategories();
    }

    // Method to get user-specific database path
    getUserDatabasePath(userId) {
        return `./data/users/${userId}/timetracker.db`;
    }

    // Method to switch context to a specific user's database
    async switchToUserDatabase(userId) {
        if (this.currentUserId === userId && this.db) {
            return; // Already connected to this user's database
        }

        // Close current connection if exists
        if (this.db) {
            await this.close();
        }

        // Connect to user-specific database
        this.currentUserId = userId;
        this.dbPath = this.getUserDatabasePath(userId);
        this.ensureDataDirectory();
        
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, async (err) => {
                if (err) {
                    reject(err);
                } else {
                    try {
                        await this.initializeTables();
                        resolve();
                    } catch (initErr) {
                        reject(initErr);
                    }
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
        
        console.log('Database: Creating time entry with params:', params);
        console.log('Database: entry.endTime is:', entry.endTime, 'type:', typeof entry.endTime);
        
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

    async getActiveTimeEntries() {
        const query = `
            SELECT te.*, t.title as task_title, t.category 
            FROM time_entries te 
            LEFT JOIN tasks t ON te.task_id = t.id 
            WHERE te.end_time IS NULL 
            ORDER BY te.start_time DESC
        `;
        console.log('Database: Querying active time entries with query:', query);
        console.log('Database: Current database path:', this.dbPath);
        console.log('Database: Current user ID:', this.currentUserId);
        const results = await this.all(query);
        console.log('Database: Found active time entries:', results.length, results);
        return results;
    }

    async getActiveTaskId() {
        const query = `SELECT task_id FROM time_entries WHERE end_time IS NULL LIMIT 1`;
        console.log('Database: Querying active task ID with query:', query);
        const result = await this.get(query);
        console.log('Database: Active task ID result:', result);
        return result ? result.task_id : null;
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

    // Category operations
    async initializeDefaultCategories() {
        const Category = require('../models/Category');
        const existingCount = await this.get('SELECT COUNT(*) as count FROM categories');
        
        if (existingCount.count === 0) {
            const defaultCategories = Category.getDefaultCategories();
            for (const category of defaultCategories) {
                await this.createCategory(category);
            }
        }
    }

    async createCategory(category) {
        const query = `INSERT INTO categories 
            (id, name, color, description, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        const params = [
            category.id, category.name, category.color, category.description,
            category.isDefault, category.createdAt, category.updatedAt
        ];
        
        return await this.run(query, params);
    }

    async updateCategory(category) {
        const query = `UPDATE categories SET 
            name = ?, color = ?, description = ?, updated_at = ?
            WHERE id = ? AND is_default = FALSE`; // Prevent updating default categories
        
        const params = [
            category.name, category.color, category.description, 
            category.updatedAt, category.id
        ];
        
        return await this.run(query, params);
    }

    async getCategories() {
        const query = `SELECT * FROM categories ORDER BY is_default DESC, name ASC`;
        return await this.all(query);
    }

    async getCategory(id) {
        const query = `SELECT * FROM categories WHERE id = ?`;
        return await this.get(query, [id]);
    }

    async deleteCategory(id) {
        // Don't allow deleting default categories
        const query = `DELETE FROM categories WHERE id = ? AND is_default = FALSE`;
        return await this.run(query, [id]);
    }

    rowToCategory(row) {
        return {
            id: row.id,
            name: row.name,
            color: row.color,
            description: row.description,
            isDefault: row.is_default === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

module.exports = Database;