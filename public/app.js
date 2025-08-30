class TimeTrackerApp {
    constructor() {
        this.apiBase = '/api';
        this.currentTab = 'tasks';
        this.currentFilter = 'all';
        this.currentCategoryFilter = '';
        this.tasks = [];
        this.activeTimer = null;
        this.activeTaskId = null;
        this.deadlineData = null;
        this.charts = {};
        this.lastUpdate = null;
        this.currentPeriod = 'week';
        this.currentChartGrouping = 'day'; // Will be set correctly in loadAnalytics
        this.user = null;
        this.token = null;
        
        this.checkAuthAndInit();
    }

    checkAuthAndInit() {
        // Check if user is authenticated
        this.token = localStorage.getItem('timeTracker_token');
        const userJson = localStorage.getItem('timeTracker_user');
        
        if (!this.token || !userJson) {
            // Redirect to login page
            window.location.href = '/login';
            return;
        }

        try {
            this.user = JSON.parse(userJson);
            this.init();
        } catch (error) {
            console.error('Invalid user data, redirecting to login');
            this.logout();
        }
    }

    async init() {
        this.updateUserDisplay();
        this.setupEventListeners();
        this.setupTimerUpdate();
        await this.loadCategories();
        await this.loadTasks();
        await this.loadSummary();
        this.updateActiveTimer();
        
        // Set today's date in log picker
        document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
        await this.loadDailyLog();
    }

    updateUserDisplay() {
        const userNameElement = document.getElementById('currentUserName');
        if (userNameElement && this.user) {
            userNameElement.textContent = this.user.username;
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Task form
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));
        
        // Category form
        document.getElementById('categoryForm').addEventListener('submit', (e) => this.handleCategorySubmit(e));

        // Filters
        document.querySelectorAll('.btn-filter').forEach(btn => {
            btn.addEventListener('click', () => this.setFilter(btn.dataset.filter));
        });

        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.currentCategoryFilter = e.target.value;
            this.filterTasks();
        });

        // Daily log date picker
        document.getElementById('logDate').addEventListener('change', () => this.loadDailyLog());

        // Modal close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    setupTimerUpdate() {
        // Update active timer frequently
        setInterval(() => this.updateActiveTimer(), 30000); // Update every 30 seconds
        
        // Refresh data periodically to keep everything in sync
        setInterval(() => this.refreshCurrentTab(), 120000); // Refresh current tab every 2 minutes
    }

    async refreshCurrentTab() {
        try {
            if (this.currentTab === 'tasks') {
                await this.loadTasks();
            } else if (this.currentTab === 'deadlines') {
                await this.loadDeadlines();
            } else if (this.currentTab === 'analytics') {
                await this.loadAnalytics();
            } else if (this.currentTab === 'logs') {
                await this.loadDailyLog();
            }
            await this.loadSummary(); // Always refresh summary stats
            this.lastUpdate = new Date();
            
            // Show a subtle refresh indicator
            this.showNotification('Data refreshed', 'info', 1000);
        } catch (error) {
            console.error('Background refresh failed:', error);
        }
    }

    async apiCall(endpoint, options = {}) {
        try {
            // Show loading indicator for operations that change data
            const isModifying = ['POST', 'PUT', 'DELETE'].includes(options.method);
            if (isModifying) {
                this.showLoading(true);
            }
            
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    ...options.headers
                },
                ...options
            });
            
            if (response.status === 401 || response.status === 403) {
                // Token is invalid, logout user
                this.logout();
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return options.method === 'DELETE' ? null : await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.showNotification('API call failed: ' + error.message, 'error');
            throw error;
        } finally {
            // Hide loading indicator
            this.showLoading(false);
        }
    }

    showLoading(show) {
        let loader = document.getElementById('globalLoader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.className = 'global-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <span>Updating...</span>
            `;
            document.body.appendChild(loader);
        }
        
        if (show) {
            loader.classList.add('show');
        } else {
            setTimeout(() => loader.classList.remove('show'), 500); // Small delay for better UX
        }
    }

    switchTab(tabName) {
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;

        // Load data for specific tabs
        if (tabName === 'analytics') {
            this.loadAnalytics();
        } else if (tabName === 'logs') {
            this.loadDailyLog();
        } else if (tabName === 'deadlines') {
            this.loadDeadlines();
        }
    }

    async handleTaskSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const taskData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            category: document.getElementById('taskCategory').value,
            priority: document.getElementById('taskPriority').value,
            estimatedTime: document.getElementById('taskEstimate').value || null,
            deadline: document.getElementById('taskDeadline').value || null
        };

        try {
            await this.apiCall('/tasks', {
                method: 'POST',
                body: JSON.stringify(taskData)
            });

            e.target.reset();
            // Immediately update all relevant views
            await Promise.all([
                this.loadTasks(),
                this.loadSummary(),
                this.currentTab === 'deadlines' ? this.loadDeadlines() : Promise.resolve()
            ]);
            this.showNotification('Task created successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to create task', 'error');
        }
    }

    async loadCategories() {
        try {
            const categories = await this.apiCall('/categories');
            this.categories = categories;
            this.populateCategorySelects();
        } catch (error) {
            console.error('Failed to load categories:', error);
            // Fall back to default categories if API fails
            this.categories = [
                { id: 'literature', name: 'Literature Review', color: '#8b5cf6' },
                { id: 'writing', name: 'Writing', color: '#06b6d4' },
                { id: 'research', name: 'Research', color: '#10b981' },
                { id: 'analysis', name: 'Analysis', color: '#f59e0b' },
                { id: 'methodology', name: 'Methodology', color: '#ef4444' },
                { id: 'general', name: 'General', color: '#6b7280' }
            ];
            this.populateCategorySelects();
        }
    }

    populateCategorySelects() {
        // Update task form category dropdown
        const taskCategorySelect = document.getElementById('taskCategory');
        if (taskCategorySelect) {
            taskCategorySelect.innerHTML = '';
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                taskCategorySelect.appendChild(option);
            });
        }

        // Update category filter dropdown
        const categoryFilterSelect = document.getElementById('categoryFilter');
        if (categoryFilterSelect) {
            // Keep the "All Categories" option
            categoryFilterSelect.innerHTML = '<option value="">All Categories</option>';
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categoryFilterSelect.appendChild(option);
            });
        }
        
        // Update category list display
        this.renderCategoryList();
    }

    async loadTasks() {
        try {
            const tasks = await this.apiCall('/tasks');
            this.tasks = tasks;
            await this.renderTasks();
        } catch (error) {
            this.showEmptyState('taskList', 'Failed to load tasks');
        }
    }

    async renderTasks() {
        const container = document.getElementById('taskList');
        
        if (!this.tasks || this.tasks.length === 0) {
            this.showEmptyState('taskList', 'No tasks yet. Create your first task above!');
            return;
        }

        const filteredTasks = this.getFilteredTasks();
        
        if (filteredTasks.length === 0) {
            this.showEmptyState('taskList', 'No tasks match your current filters');
            return;
        }

        container.innerHTML = filteredTasks.map(task => this.renderTask(task)).join('');
    }

    renderTask(task) {
        const timeSpent = this.formatTime(task.totalTime || task.actualTime || 0);
        const estimatedTime = task.estimatedTime ? this.formatTime(task.estimatedTime) : 'Not set';
        const progress = task.progress || 0;
        const isActive = this.activeTaskId === task.id;
        
        let deadlineClasses = '';
        let deadlineInfo = '';
        
        if (task.deadline) {
            const deadlineDate = new Date(task.deadline);
            const daysUntil = task.daysUntilDeadline;
            
            if (task.isOverdue) {
                deadlineClasses = 'deadline-overdue';
                deadlineInfo = `<div class="deadline-info"><i class="fas fa-exclamation-triangle"></i> Overdue by ${Math.abs(daysUntil)} day(s)</div>`;
            } else if (task.isDueSoon) {
                deadlineClasses = 'deadline-soon';
                deadlineInfo = `<div class="deadline-info"><i class="fas fa-clock"></i> Due in ${daysUntil} day(s)</div>`;
            } else {
                deadlineInfo = `<div class="deadline-info"><i class="fas fa-calendar"></i> Due ${deadlineDate.toLocaleDateString()}</div>`;
            }
        }
        
        return `
            <div class="task-item priority-${task.priority} ${deadlineClasses} ${isActive ? 'task-working' : ''}" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-title">
                        ${task.title}
                        ${isActive ? '<span class="working-indicator"><i class="fas fa-play"></i> Working</span>' : ''}
                    </div>
                    <div class="task-status ${task.status}">${task.status.replace('_', ' ')}</div>
                </div>
                
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                
                <div class="task-meta">
                    <span><i class="fas fa-tag"></i> ${task.category}</span>
                    <span><i class="fas fa-clock"></i> ${timeSpent} / ${estimatedTime}</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                
                ${deadlineInfo}
                
                ${task.children && task.children.length > 0 ? `
                    <div class="task-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <small>${progress}% complete (${task.children.filter(c => c.status === 'completed').length}/${task.children.length} subtasks)</small>
                    </div>
                ` : ''}
                
                <div class="task-actions">
                    ${this.renderTaskActions(task)}
                </div>
                
                <!-- Subtask Form -->
                <div id="subtask-form-${task.id}" class="subtask-form">
                    <h4>Add Subtask</h4>
                    <form onsubmit="app.handleSubtaskSubmit(event, '${task.id}')">
                        <div class="form-group">
                            <input type="text" placeholder="Subtask title" name="title" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <select name="priority">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <input type="date" name="deadline" placeholder="Deadline (optional)">
                            </div>
                        </div>
                        <div class="form-group">
                            <textarea name="description" placeholder="Description (optional)" rows="2"></textarea>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button type="submit" class="btn btn-primary btn-small">Add Subtask</button>
                            <button type="button" class="btn btn-secondary btn-small" onclick="app.cancelSubtask('${task.id}')">Cancel</button>
                        </div>
                    </form>
                </div>
                
                ${task.children && task.children.length > 0 ? `
                    <div class="task-children">
                        ${task.children.map(child => this.renderTask(child)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderTaskActions(task) {
        const actions = [];
        const isActive = this.activeTaskId === task.id;
        
        // Time tracking actions
        if (task.status !== 'completed') {
            if (isActive) {
                actions.push(`<button class="btn btn-error btn-small" onclick="app.stopTask('${task.id}')"><i class="fas fa-stop"></i> Stop Working</button>`);
            } else {
                actions.push(`<button class="btn btn-success btn-small" onclick="app.startTask('${task.id}')"><i class="fas fa-play"></i> Start Working</button>`);
            }
        }

        // Status actions
        if (task.status !== 'completed') {
            actions.push(`<button class="btn btn-success btn-small" onclick="app.updateTaskStatus('${task.id}', 'completed')"><i class="fas fa-check"></i> Complete</button>`);
        } else if (task.status === 'completed') {
            actions.push(`<button class="btn btn-secondary btn-small" onclick="app.updateTaskStatus('${task.id}', 'todo')"><i class="fas fa-undo"></i> Reopen</button>`);
        }

        // Subtask action
        actions.push(`<button class="btn btn-primary btn-small" onclick="app.showSubtaskForm('${task.id}')"><i class="fas fa-plus"></i> Add Subtask</button>`);

        // Other actions
        actions.push(`<button class="btn btn-secondary btn-small" onclick="app.showTaskDetails('${task.id}')"><i class="fas fa-eye"></i> Details</button>`);
        actions.push(`<button class="btn btn-error btn-small" onclick="app.deleteTask('${task.id}')"><i class="fas fa-trash"></i> Delete</button>`);

        return actions.join('');
    }

    getFilteredTasks() {
        let filtered = this.tasks;

        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(task => task.status === this.currentFilter);
        }

        if (this.currentCategoryFilter) {
            filtered = filtered.filter(task => task.category === this.currentCategoryFilter);
        }

        return filtered;
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        document.querySelectorAll('.btn-filter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderTasks();
    }

    filterTasks() {
        this.renderTasks();
    }

    showSubtaskForm(taskId) {
        const form = document.getElementById(`subtask-form-${taskId}`);
        form.classList.add('show');
    }

    cancelSubtask(taskId) {
        const form = document.getElementById(`subtask-form-${taskId}`);
        form.classList.remove('show');
        form.querySelector('form').reset();
    }

    async handleSubtaskSubmit(e, parentId) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const subtaskData = {
            title: formData.get('title'),
            description: formData.get('description') || '',
            priority: formData.get('priority'),
            deadline: formData.get('deadline') || null,
            category: this.tasks.find(t => t.id === parentId)?.category || 'general'
        };

        try {
            await this.apiCall(`/tasks/${parentId}/subtask`, {
                method: 'POST',
                body: JSON.stringify(subtaskData)
            });

            this.cancelSubtask(parentId);
            // Immediately update all relevant views
            await Promise.all([
                this.loadTasks(),
                this.loadSummary(),
                this.currentTab === 'deadlines' ? this.loadDeadlines() : Promise.resolve()
            ]);
            this.showNotification('Subtask created successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to create subtask', 'error');
        }
    }

    async startTask(taskId) {
        try {
            await this.apiCall(`/tasks/${taskId}/start`, { method: 'POST' });
            // Immediately update all relevant views
            await Promise.all([
                this.loadTasks(),
                this.updateActiveTimer(),
                this.loadSummary(),
                this.currentTab === 'deadlines' ? this.loadDeadlines() : Promise.resolve()
            ]);
            this.showNotification('Time tracking started!', 'success');
        } catch (error) {
            this.showNotification('Failed to start time tracking', 'error');
        }
    }

    async stopTask(taskId) {
        try {
            await this.apiCall(`/tasks/${taskId}/stop`, { method: 'POST' });
            // Immediately update all relevant views
            await Promise.all([
                this.loadTasks(),
                this.updateActiveTimer(),
                this.loadSummary(),
                this.currentTab === 'deadlines' ? this.loadDeadlines() : Promise.resolve(),
                this.currentTab === 'logs' ? this.loadDailyLog() : Promise.resolve()
            ]);
            this.showNotification('Time tracking stopped', 'success');
        } catch (error) {
            this.showNotification('Failed to stop time tracking', 'error');
        }
    }

    async updateTaskStatus(taskId, status) {
        try {
            await this.apiCall(`/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            // Immediately update all relevant views
            await Promise.all([
                this.loadTasks(),
                this.loadSummary(),
                this.currentTab === 'deadlines' ? this.loadDeadlines() : Promise.resolve(),
                this.currentTab === 'logs' ? this.loadDailyLog() : Promise.resolve()
            ]);
            this.showNotification(`Task ${status.replace('_', ' ')}!`, 'success');
        } catch (error) {
            this.showNotification('Failed to update task status', 'error');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            return;
        }

        try {
            await this.apiCall(`/tasks/${taskId}`, { method: 'DELETE' });
            // Immediately update all relevant views
            await Promise.all([
                this.loadTasks(),
                this.loadSummary(),
                this.currentTab === 'deadlines' ? this.loadDeadlines() : Promise.resolve(),
                this.currentTab === 'analytics' ? this.loadAnalytics() : Promise.resolve()
            ]);
            this.showNotification('Task deleted', 'success');
        } catch (error) {
            this.showNotification('Failed to delete task', 'error');
        }
    }

    async updateActiveTimer() {
        try {
            const deadlineData = await this.apiCall('/analytics/deadlines');
            this.activeTaskId = deadlineData.activeTaskId;
            
            const activeEntries = await this.apiCall('/analytics/active');
            const timerElement = document.getElementById('activeTimer');
            const timerText = document.getElementById('timerText');
            
            if (activeEntries.length > 0) {
                const entry = activeEntries[0]; // Show first active entry
                timerElement.style.display = 'flex';
                timerText.textContent = this.formatTime(entry.duration);
            } else {
                timerElement.style.display = 'none';
                this.activeTaskId = null;
            }
            
            // Re-render tasks if they're currently displayed
            if (this.currentTab === 'tasks' && this.tasks.length > 0) {
                await this.renderTasks();
            }
        } catch (error) {
            console.error('Failed to update active timer:', error);
        }
    }

    async loadDeadlines() {
        try {
            const deadlineData = await this.apiCall('/analytics/deadlines');
            this.deadlineData = deadlineData;
            this.activeTaskId = deadlineData.activeTaskId;
            
            this.renderDeadlineTasks('overdueTasks', deadlineData.overdue, 'No overdue tasks! 🎉');
            this.renderDeadlineTasks('dueTomorrowTasks', deadlineData.dueTomorrow, 'Nothing due tomorrow');
            this.renderDeadlineTasks('dueThisWeekTasks', deadlineData.dueThisWeek, 'Nothing due this week');
            
        } catch (error) {
            console.error('Failed to load deadlines:', error);
            document.getElementById('overdueTasks').innerHTML = '<p>Failed to load deadline data</p>';
        }
    }

    renderDeadlineTasks(containerId, tasks, emptyMessage) {
        const container = document.getElementById(containerId);
        
        if (!tasks || tasks.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>${emptyMessage}</p></div>`;
            return;
        }
        
        container.innerHTML = tasks.map(task => this.renderSimpleTask(task)).join('');
    }

    renderSimpleTask(task) {
        const isActive = this.activeTaskId === task.id;
        const timeSpent = this.formatTime(task.totalTime || task.actualTime || 0);
        
        let deadlineInfo = '';
        if (task.deadline) {
            const deadlineDate = new Date(task.deadline);
            const daysUntil = task.daysUntilDeadline;
            
            if (task.isOverdue) {
                deadlineInfo = `<small class="text-error">Overdue by ${Math.abs(daysUntil)} day(s)</small>`;
            } else if (task.isDueSoon) {
                deadlineInfo = `<small class="text-warning">Due in ${daysUntil} day(s)</small>`;
            } else {
                deadlineInfo = `<small>Due ${deadlineDate.toLocaleDateString()}</small>`;
            }
        }
        
        return `
            <div class="task-log-item ${isActive ? 'task-working' : ''}">
                <div>
                    <strong>${task.title}</strong>
                    ${isActive ? '<span class="working-indicator"><i class="fas fa-play"></i></span>' : ''}
                    <br>
                    <small>${task.category} • ${timeSpent}</small>
                    ${deadlineInfo ? '<br>' + deadlineInfo : ''}
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${task.status !== 'completed' ? (
                        isActive 
                            ? `<button class="btn btn-error btn-small" onclick="app.stopTask('${task.id}')"><i class="fas fa-stop"></i></button>`
                            : `<button class="btn btn-success btn-small" onclick="app.startTask('${task.id}')"><i class="fas fa-play"></i></button>`
                    ) : ''}
                    ${task.status !== 'completed' 
                        ? `<button class="btn btn-success btn-small" onclick="app.updateTaskStatus('${task.id}', 'completed')"><i class="fas fa-check"></i></button>`
                        : `<span class="text-success"><i class="fas fa-check-circle"></i></span>`
                    }
                </div>
            </div>
        `;
    }

    async loadSummary() {
        try {
            const summary = await this.apiCall('/analytics/summary');
            
            // Update today's stats with null checks
            const todayTimeEl = document.getElementById('todayTime');
            const todayTasksEl = document.getElementById('todayTasks');
            const weekTimeEl = document.getElementById('weekTime');
            const productivityScoreEl = document.getElementById('productivityScore');
            
            if (todayTimeEl && summary.today) {
                todayTimeEl.textContent = this.formatTime(summary.today.time || 0);
            }
            if (todayTasksEl && summary.today) {
                todayTasksEl.textContent = summary.today.tasksCompleted || 0;
            }
            if (weekTimeEl && summary.week) {
                weekTimeEl.textContent = this.formatTime(summary.week.totalTime || 0);
            }
            if (productivityScoreEl && summary.today) {
                productivityScoreEl.textContent = Math.round(summary.today.productivityScore || 0);
            }
            
        } catch (error) {
            console.error('Failed to load summary:', error);
        }
    }

    async loadAnalytics() {
        try {
            // Ensure chart grouping is optimal for current period
            this.currentChartGrouping = this.getOptimalChartGrouping(this.currentPeriod);
            this.updateGroupingDisplay();
            
            // Load data based on current period and grouping
            const trends = await this.apiCall(`/analytics/time-trends-enhanced?period=${this.currentChartGrouping}&duration=${this.currentPeriod}`);
            const summary = await this.apiCall(`/analytics/summary?period=${this.currentPeriod}`);
            
            // Update summary cards with null checks
            const periodTimeEl = document.getElementById('periodTime');
            const periodTimeLabelEl = document.getElementById('periodTimeLabel');
            const productivityScoreEl = document.getElementById('productivityScore');
            
            if (periodTimeEl && summary && summary.week) {
                periodTimeEl.textContent = this.formatTime(summary.week.totalTime || 0);
            } else if (periodTimeEl && trends) {
                // Fallback to trends data
                periodTimeEl.textContent = this.formatTime(trends.totalTime || 0);
            }
            
            if (periodTimeLabelEl) {
                periodTimeLabelEl.textContent = this.getPeriodLabel(this.currentPeriod);
            }
            
            if (productivityScoreEl && summary && summary.week) {
                productivityScoreEl.textContent = Math.round(summary.week.averageProductivity || 0);
            }
            
            // Update charts
            this.renderTimeChart(trends.timeByPeriod, trends.period);
            this.renderCategoryChart(trends.categoryBreakdown);
            
            // Update detailed statistics
            this.renderDetailedStats(summary);
            
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    getPeriodLabel(period) {
        switch (period) {
            case 'week': return 'Last Week';
            case 'month': return 'Last Month';
            case 'year': return 'Last Year';
            case 'all': return 'All Time';
            default: return 'Last Week';
        }
    }

    getOptimalChartGrouping(period) {
        // Automatically determine the best chart grouping based on time period
        switch (period) {
            case 'week':
                return 'day';     // Last week → group by day
            case 'month':
                return 'day';     // Last month → group by day  
            case 'year':
                return 'month';   // Last year → group by month
            case 'all':
                return 'month';   // All time → group by month (could be year for very long periods)
            default:
                return 'day';
        }
    }

    getGroupingLabel(grouping) {
        switch (grouping) {
            case 'day':
                return 'Daily';
            case 'week':
                return 'Weekly';
            case 'month':
                return 'Monthly';
            case 'year':
                return 'Yearly';
            default:
                return 'Daily';
        }
    }

    updateGroupingDisplay() {
        const groupingSpan = document.getElementById('currentGrouping');
        if (groupingSpan) {
            groupingSpan.textContent = this.getGroupingLabel(this.currentChartGrouping);
        }
    }

    async updateAnalyticsPeriod() {
        this.currentPeriod = document.getElementById('periodSelect').value;
        // Automatically set the optimal chart grouping
        this.currentChartGrouping = this.getOptimalChartGrouping(this.currentPeriod);
        this.updateGroupingDisplay();
        await this.loadAnalytics();
    }

    async exportTasks() {
        try {
            this.showLoading(true);
            const response = await fetch(`${this.apiBase}/analytics/export/tasks`);
            
            if (!response.ok) {
                throw new Error('Export failed');
            }
            
            // Create download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification('Tasks exported successfully!', 'success');
        } catch (error) {
            this.showNotification('Export failed: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async exportTimeEntries() {
        try {
            this.showLoading(true);
            const response = await fetch(`${this.apiBase}/analytics/export/time-entries`);
            
            if (!response.ok) {
                throw new Error('Export failed');
            }
            
            // Create download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `time-entries-export-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification('Time entries exported successfully!', 'success');
        } catch (error) {
            this.showNotification('Export failed: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderTimeChart(data, period = 'day') {
        try {
            const canvas = document.getElementById('timeChart');
            if (!canvas) {
                console.error('timeChart canvas not found');
                return;
            }
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Could not get 2d context for timeChart');
                return;
            }
            
            if (this.charts.timeChart) {
                this.charts.timeChart.destroy();
            }
            
            if (!data || data.length === 0) {
                console.warn('No data provided for time chart');
                // Hide canvas and show empty state message
                canvas.style.display = 'none';
                let emptyMessage = canvas.parentElement.querySelector('.chart-empty-state');
                if (!emptyMessage) {
                    emptyMessage = document.createElement('div');
                    emptyMessage.className = 'chart-empty-state text-muted';
                    canvas.parentElement.appendChild(emptyMessage);
                }
                // Create informative message based on current period
                const periodLabel = this.getPeriodLabel(this.currentPeriod).toLowerCase();
                emptyMessage.innerHTML = `
                    <div class="empty-chart-content">
                        <i class="fas fa-chart-line" style="font-size: 2rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                        <p><strong>No time tracking data for ${periodLabel}</strong></p>
                        <p>Start tracking time on your tasks to see productivity charts and trends.</p>
                    </div>
                `;
                emptyMessage.style.display = 'block';
                return;
            } else {
                // Show canvas and hide empty state message
                canvas.style.display = 'block';
                const emptyMessage = canvas.parentElement.querySelector('.chart-empty-state');
                if (emptyMessage) {
                    emptyMessage.style.display = 'none';
                }
            }
            
            if (typeof Chart === 'undefined') {
                console.error('Chart.js library not loaded');
                return;
            }
        
        // Update chart title based on grouping
        const title = document.getElementById('timeChartTitle');
        title.textContent = `${period.charAt(0).toUpperCase() + period.slice(1)}ly Time Tracking`;
        
        const labels = data.map(d => {
            if (period === 'week') {
                return d.period; // e.g., "2024-W10"
            } else if (period === 'month') {
                return d.period; // e.g., "2024-03"
            } else if (period === 'year') {
                return d.period; // e.g., "2024"
            } else {
                return new Date(d.period || d.date).toLocaleDateString();
            }
        });
        
        this.charts.timeChart = new Chart(ctx, {
            type: period === 'year' ? 'bar' : 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Time (minutes)',
                    data: data.map(d => d.time || 0),
                    borderColor: '#3b82f6',
                    backgroundColor: period === 'year' ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: period !== 'year'
                }, {
                    label: 'Tasks Completed',
                    data: data.map(d => d.tasks || 0),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    yAxisID: 'y1',
                    type: 'line',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Math.floor(value / 60) + 'h ' + (value % 60) + 'm';
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false,
                        },
                        ticks: {
                            callback: function(value) {
                                return Math.floor(value) + ' tasks';
                            }
                        }
                    }
                }
            }
        });
        } catch (error) {
            console.error('Error rendering time chart:', error);
        }
    }

    renderDetailedStats(summary) {
        const container = document.getElementById('detailedStats');
        if (!container) return;
        
        // Handle missing or incomplete summary data
        const totalTime = (summary && summary.week && summary.week.totalTime) || 0;
        const totalHours = Math.floor(totalTime / 60);
        const totalMinutes = totalTime % 60;
        
        container.innerHTML = `
            <div class="detailed-stats-grid">
                <div class="stat-item">
                    <h4>${this.getPeriodLabel(this.currentPeriod)} Summary</h4>
                    <table class="detailed-stats-table">
                        <tr>
                            <td>Total Time:</td>
                            <td class="stat-highlight">${totalHours}h ${totalMinutes}m</td>
                        </tr>
                        <tr>
                            <td>Tasks Completed:</td>
                            <td class="stat-highlight">${(summary && summary.week && summary.week.tasksCompleted) || 0}</td>
                        </tr>
                        <tr>
                            <td>Average Productivity:</td>
                            <td class="stat-highlight">${Math.round((summary && summary.week && summary.week.averageProductivity) || 0)}/100</td>
                        </tr>
                        <tr>
                            <td>Active Tasks:</td>
                            <td class="stat-highlight">${(summary && summary.overall && summary.overall.inProgressTasks) || 0}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="stat-item">
                    <h4>Category Breakdown</h4>
                    <table class="detailed-stats-table">
                        ${Object.entries((summary && summary.week && summary.week.categoryBreakdown) || {}).map(([category, time]) => {
                            const hours = Math.floor(time / 60);
                            const minutes = time % 60;
                            return `
                                <tr>
                                    <td>${category.charAt(0).toUpperCase() + category.slice(1)}:</td>
                                    <td class="stat-highlight">${hours}h ${minutes}m</td>
                                </tr>
                            `;
                        }).join('')}
                    </table>
                </div>
            </div>
        `;
    }

    renderCategoryChart(data) {
        try {
            const canvas = document.getElementById('categoryChart');
            if (!canvas) {
                console.error('categoryChart canvas not found');
                return;
            }
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Could not get 2d context for categoryChart');
                return;
            }
            
            if (this.charts.categoryChart) {
                this.charts.categoryChart.destroy();
            }
            
            if (!data || Object.keys(data).length === 0) {
                console.warn('No data provided for category chart');
                // Hide canvas and show empty state message
                canvas.style.display = 'none';
                let emptyMessage = canvas.parentElement.querySelector('.chart-empty-state');
                if (!emptyMessage) {
                    emptyMessage = document.createElement('div');
                    emptyMessage.className = 'chart-empty-state text-muted';
                    canvas.parentElement.appendChild(emptyMessage);
                }
                // Create informative message based on current period
                const periodLabel = this.getPeriodLabel(this.currentPeriod).toLowerCase();
                emptyMessage.innerHTML = `
                    <div class="empty-chart-content">
                        <i class="fas fa-chart-pie" style="font-size: 2rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                        <p><strong>No category data for ${periodLabel}</strong></p>
                        <p>Track time on tasks with different categories to see breakdowns here.</p>
                    </div>
                `;
                emptyMessage.style.display = 'block';
                return;
            } else {
                // Show canvas and hide empty state message
                canvas.style.display = 'block';
                const emptyMessage = canvas.parentElement.querySelector('.chart-empty-state');
                if (emptyMessage) {
                    emptyMessage.style.display = 'none';
                }
            }
            
            if (typeof Chart === 'undefined') {
                console.error('Chart.js library not loaded');
                return;
            }
        
        const colors = [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
        ];
        
        this.charts.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: colors.slice(0, Object.keys(data).length)
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const hours = Math.floor(value / 60);
                                const minutes = value % 60;
                                return `${context.label}: ${hours}h ${minutes}m`;
                            }
                        }
                    }
                }
            }
        });
        } catch (error) {
            console.error('Error rendering category chart:', error);
        }
    }

    async loadDailyLog() {
        const date = document.getElementById('logDate').value;
        
        try {
            const log = await this.apiCall(`/logs/${date}`);
            this.renderDailyLog(log);
        } catch (error) {
            document.getElementById('dailyLogContent').innerHTML = '<p>Failed to load daily log</p>';
        }
    }

    renderDailyLog(log) {
        const container = document.getElementById('dailyLogContent');
        const totalHours = Math.floor(log.totalTime / 60);
        const totalMinutes = log.totalTime % 60;
        
        container.innerHTML = `
            <div class="daily-summary">
                <div class="summary-item">
                    <h4>${totalHours}h ${totalMinutes}m</h4>
                    <p>Total Time</p>
                </div>
                <div class="summary-item">
                    <h4>${log.tasksCompleted.length}</h4>
                    <p>Tasks Completed</p>
                </div>
                <div class="summary-item">
                    <h4>${log.tasksWorkedOn.length}</h4>
                    <p>Tasks Worked On</p>
                </div>
                <div class="summary-item">
                    <h4>${log.productivityScore}</h4>
                    <p>Productivity Score</p>
                </div>
            </div>
            
            ${log.tasksCompleted.length > 0 ? `
                <div class="task-log">
                    <h4><i class="fas fa-check-circle"></i> Completed Tasks</h4>
                    ${log.tasksCompleted.map(task => `
                        <div class="task-log-item">
                            <span>${task.title}</span>
                            <i class="fas fa-check text-success"></i>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${log.tasksWorkedOn.length > 0 ? `
                <div class="task-log">
                    <h4><i class="fas fa-clock"></i> Tasks Worked On</h4>
                    ${log.tasksWorkedOn.map(task => {
                        const hours = Math.floor(task.timeSpent / 60);
                        const minutes = task.timeSpent % 60;
                        return `
                            <div class="task-log-item">
                                <span>${task.title}</span>
                                <span>${hours}h ${minutes}m</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
            
            <div class="notes-section">
                <h4><i class="fas fa-sticky-note"></i> Daily Notes</h4>
                <textarea placeholder="Add your notes for the day..." 
                          onchange="app.updateDailyNotes('${log.date}', this.value)">${log.notes || ''}</textarea>
            </div>
        `;
    }

    async updateDailyNotes(date, notes) {
        try {
            await this.apiCall(`/logs/${date}/notes`, {
                method: 'PUT',
                body: JSON.stringify({ notes })
            });
            this.showNotification('Notes saved', 'success');
        } catch (error) {
            this.showNotification('Failed to save notes', 'error');
        }
    }


    showTaskDetails(taskId) {
        const task = this.findTaskById(taskId);
        if (!task) return;

        const modal = document.getElementById('taskModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        
        title.textContent = task.title;
        body.innerHTML = `
            <div class="task-details">
                <p><strong>Description:</strong> ${task.description || 'No description'}</p>
                <p><strong>Category:</strong> ${task.category}</p>
                <p><strong>Priority:</strong> ${task.priority}</p>
                <p><strong>Status:</strong> ${task.status}</p>
                <p><strong>Time Spent:</strong> ${this.formatTime(task.totalTime || task.actualTime || 0)}</p>
                <p><strong>Estimated Time:</strong> ${task.estimatedTime ? this.formatTime(task.estimatedTime) : 'Not set'}</p>
                ${task.deadline ? `<p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` : ''}
                ${task.deadline && task.daysUntilDeadline !== null ? `<p><strong>Days Until Deadline:</strong> ${task.daysUntilDeadline}</p>` : ''}
                <p><strong>Created:</strong> ${new Date(task.createdAt).toLocaleString()}</p>
                ${task.completedAt ? `<p><strong>Completed:</strong> ${new Date(task.completedAt).toLocaleString()}</p>` : ''}
                ${task.children && task.children.length > 0 ? `<p><strong>Subtasks:</strong> ${task.children.length} (${task.children.filter(c => c.status === 'completed').length} completed)</p>` : ''}
            </div>
        `;
        
        modal.classList.add('show');
    }

    findTaskById(taskId) {
        const searchInTasks = (tasks) => {
            for (const task of tasks) {
                if (task.id === taskId) return task;
                if (task.children) {
                    const found = searchInTasks(task.children);
                    if (found) return found;
                }
            }
            return null;
        };
        
        return searchInTasks(this.tasks);
    }

    closeModal() {
        document.getElementById('taskModal').classList.remove('show');
    }

    showEmptyState(containerId, message) {
        document.getElementById(containerId).innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>${message}</p>
            </div>
        `;
    }

    showNotification(message, type = 'info', duration = 3000) {
        // Simple notification - could be enhanced with a proper notification system
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: ${document.getElementById('globalLoader') ? '80px' : '20px'};
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
            font-size: 0.875rem;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    formatTime(minutes) {
        if (!minutes) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    async handleCategorySubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const editingId = form.dataset.editingId;
        
        const categoryData = {
            name: document.getElementById('categoryName').value,
            color: document.getElementById('categoryColor').value,
            description: document.getElementById('categoryDescription').value
        };

        try {
            if (editingId) {
                // Update existing category
                await this.apiCall(`/categories/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(categoryData)
                });
                this.showNotification('Category updated successfully!', 'success');
            } else {
                // Create new category
                await this.apiCall('/categories', {
                    method: 'POST',
                    body: JSON.stringify(categoryData)
                });
                this.showNotification('Category created successfully!', 'success');
            }

            // Reset form
            form.reset();
            document.getElementById('categoryColor').value = '#3b82f6';
            form.removeAttribute('data-editing-id');
            form.querySelector('button[type="submit"]').textContent = 'Create Category';
            
            // Refresh categories
            await this.loadCategories();
        } catch (error) {
            const action = editingId ? 'update' : 'create';
            this.showNotification(`Failed to ${action} category`, 'error');
        }
    }

    async editCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        // Fill form with existing data
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categoryColor').value = category.color;
        document.getElementById('categoryDescription').value = category.description || '';

        // Change form to edit mode
        const form = document.getElementById('categoryForm');
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.textContent = 'Update Category';
        
        // Store category ID for update
        form.dataset.editingId = categoryId;
        
        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
    }

    async deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
            return;
        }

        try {
            await this.apiCall(`/categories/${categoryId}`, {
                method: 'DELETE'
            });

            await this.loadCategories();
            this.showNotification('Category deleted successfully!', 'success');
        } catch (error) {
            if (error.message && error.message.includes('used by tasks')) {
                this.showNotification('Cannot delete category that is used by tasks', 'error');
            } else {
                this.showNotification('Failed to delete category', 'error');
            }
        }
    }

    renderCategoryList() {
        const container = document.getElementById('categoryList');
        if (!container || !this.categories) return;

        if (this.categories.length === 0) {
            container.innerHTML = '<p class="text-muted">No categories available</p>';
            return;
        }

        container.innerHTML = this.categories.map(category => `
            <div class="category-item">
                <div class="category-info">
                    <div class="category-color" style="background-color: ${category.color}"></div>
                    <div class="category-details">
                        <div class="category-name">${category.name}</div>
                        ${category.description ? `<div class="category-description">${category.description}</div>` : ''}
                        ${category.isDefault ? '<div class="category-default">Default Category</div>' : ''}
                    </div>
                </div>
                <div class="category-actions">
                    ${!category.isDefault ? `
                        <button class="btn-category edit" onclick="app.editCategory('${category.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-category delete" onclick="app.deleteCategory('${category.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : `
                        <button class="btn-category edit" disabled>
                            <i class="fas fa-lock"></i> Protected
                        </button>
                    `}
                </div>
            </div>
        `).join('');
    }

    logout() {
        // Clear local storage
        localStorage.removeItem('timeTracker_token');
        localStorage.removeItem('timeTracker_user');
        
        // Redirect to login page
        window.location.href = '/login';
    }
}

// Global functions for onclick handlers
window.app = new TimeTrackerApp();

function toggleCard(button) {
    const content = button.closest('.card').querySelector('.card-content');
    content.classList.toggle('collapsed');
    const icon = button.querySelector('i');
    icon.classList.toggle('fa-chevron-up');
    icon.classList.toggle('fa-chevron-down');
}

function closeModal() {
    app.closeModal();
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);