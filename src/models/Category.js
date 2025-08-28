const { v4: uuidv4 } = require('uuid');

class Category {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.name = data.name || '';
        this.color = data.color || '#3b82f6'; // Default blue color
        this.description = data.description || '';
        this.isDefault = data.isDefault || false; // Built-in categories
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    static getDefaultCategories() {
        return [
            new Category({
                id: 'literature',
                name: 'Literature Review',
                color: '#8b5cf6',
                description: 'Reading papers, books, and research materials',
                isDefault: true
            }),
            new Category({
                id: 'writing',
                name: 'Writing',
                color: '#06b6d4',
                description: 'Writing chapters, sections, and documentation',
                isDefault: true
            }),
            new Category({
                id: 'research',
                name: 'Research',
                color: '#10b981',
                description: 'Active research, experiments, and data collection',
                isDefault: true
            }),
            new Category({
                id: 'analysis',
                name: 'Analysis',
                color: '#f59e0b',
                description: 'Data analysis, processing, and interpretation',
                isDefault: true
            }),
            new Category({
                id: 'methodology',
                name: 'Methodology',
                color: '#ef4444',
                description: 'Research design, planning, and methodology work',
                isDefault: true
            }),
            new Category({
                id: 'general',
                name: 'General',
                color: '#6b7280',
                description: 'General tasks and miscellaneous work',
                isDefault: true
            })
        ];
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            description: this.description,
            isDefault: this.isDefault,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Category;