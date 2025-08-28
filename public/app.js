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
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupTimerUpdate();
        await this.loadTasks();
        await this.loadSummary();
        this.updateActiveTimer();
        
        // Set today's date in log picker
        document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
        await this.loadDailyLog();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Task form
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));

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
        setInterval(() => this.updateActiveTimer(), 30000); // Update every 30 seconds
    }

    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return options.method === 'DELETE' ? null : await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.showNotification('API call failed: ' + error.message, 'error');
            throw error;
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
            await this.loadTasks();
            if (this.currentTab === 'deadlines') {
                await this.loadDeadlines();
            }
            this.showNotification('Task created successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to create task', 'error');
        }
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
            await this.loadTasks();
            if (this.currentTab === 'deadlines') {
                await this.loadDeadlines();
            }
            this.showNotification('Subtask created successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to create subtask', 'error');
        }
    }

    async startTask(taskId) {
        try {
            await this.apiCall(`/tasks/${taskId}/start`, { method: 'POST' });
            await this.loadTasks();
            await this.updateActiveTimer();
            if (this.currentTab === 'deadlines') {
                await this.loadDeadlines();
            }
            this.showNotification('Time tracking started!', 'success');
        } catch (error) {
            this.showNotification('Failed to start time tracking', 'error');
        }
    }

    async stopTask(taskId) {
        try {
            await this.apiCall(`/tasks/${taskId}/stop`, { method: 'POST' });
            await this.loadTasks();
            await this.updateActiveTimer();
            if (this.currentTab === 'deadlines') {
                await this.loadDeadlines();
            }
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
            await this.loadTasks();
            if (this.currentTab === 'deadlines') {
                await this.loadDeadlines();
            }
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
            await this.loadTasks();
            if (this.currentTab === 'deadlines') {
                await this.loadDeadlines();
            }
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
            
            // Update today's stats
            document.getElementById('todayTime').textContent = this.formatTime(summary.today.time);
            document.getElementById('todayTasks').textContent = summary.today.tasksCompleted;
            document.getElementById('weekTime').textContent = this.formatTime(summary.week.totalTime);
            document.getElementById('productivityScore').textContent = Math.round(summary.today.productivityScore);
            
        } catch (error) {
            console.error('Failed to load summary:', error);
        }
    }

    async loadAnalytics() {
        try {
            const trends = await this.apiCall('/analytics/time-trends/7');
            
            // Update time chart
            this.renderTimeChart(trends.timeByDay);
            this.renderCategoryChart(trends.categoryBreakdown);
            
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    renderTimeChart(data) {
        const ctx = document.getElementById('timeChart').getContext('2d');
        
        if (this.charts.timeChart) {
            this.charts.timeChart.destroy();
        }
        
        this.charts.timeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Time (minutes)',
                    data: data.map(d => d.time),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Math.floor(value / 60) + 'h ' + (value % 60) + 'm';
                            }
                        }
                    }
                }
            }
        });
    }

    renderCategoryChart(data) {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        if (this.charts.categoryChart) {
            this.charts.categoryChart.destroy();
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

    showNotification(message, type = 'info') {
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
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    formatTime(minutes) {
        if (!minutes) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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