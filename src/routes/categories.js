const express = require('express');
const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
    try {
        const categories = await req.app.locals.taskService.getCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get specific category
router.get('/:id', async (req, res) => {
    try {
        const category = await req.app.locals.taskService.getCategory(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

// Create new category
router.post('/', async (req, res) => {
    try {
        const { name, color, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const categoryData = {
            name,
            color: color || '#3b82f6',
            description: description || '',
            isDefault: false
        };

        const category = await req.app.locals.taskService.createCategory(categoryData);
        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        if (error.message.includes('UNIQUE constraint')) {
            res.status(400).json({ error: 'Category name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create category' });
        }
    }
});

// Update category
router.put('/:id', async (req, res) => {
    try {
        const { name, color, description } = req.body;
        
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (color !== undefined) updates.color = color;
        if (description !== undefined) updates.description = description;

        const category = await req.app.locals.taskService.updateCategory(req.params.id, updates);
        res.json(category);
    } catch (error) {
        console.error('Error updating category:', error);
        if (error.message === 'Category not found') {
            res.status(404).json({ error: 'Category not found' });
        } else if (error.message.includes('UNIQUE constraint')) {
            res.status(400).json({ error: 'Category name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to update category' });
        }
    }
});

// Delete category
router.delete('/:id', async (req, res) => {
    try {
        await req.app.locals.taskService.deleteCategory(req.params.id);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        if (error.message === 'Cannot delete category that is used by tasks') {
            res.status(400).json({ error: 'Cannot delete category that is used by tasks' });
        } else if (error.message.includes('not found') || error.message.includes('protected')) {
            res.status(404).json({ error: 'Category not found or cannot be deleted (default categories are protected)' });
        } else {
            res.status(500).json({ error: 'Failed to delete category' });
        }
    }
});

module.exports = router;