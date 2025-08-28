# Time Tracker - Master's Thesis Assistant

A comprehensive hierarchical time tracking system designed specifically for managing master's thesis work and university tasks. This application provides a complete solution for task management, time tracking, and productivity analysis with a focus on academic work organization.

## 🎯 Features

### Task Management
- **Hierarchical Task Structure**: Organize tasks in a tree-like structure with parent-child relationships
- **Multiple Categories**: Literature Review, Writing, Research, Analysis, Methodology, and General
- **Priority Levels**: High, Medium, and Low priority task organization
- **Status Tracking**: Todo, In Progress, and Completed task states
- **Time Estimation**: Set estimated time for tasks and track actual time spent

### Time Tracking
- **Start/Stop/Pause**: Full control over time tracking sessions
- **Real-time Timer**: Live timer display showing current active work session
- **Automatic Logging**: All time entries are automatically saved with task associations
- **Multiple Task Support**: Track time across different tasks (one active at a time)

### Daily Logging
- **Automatic Daily Summaries**: Comprehensive daily work logs
- **Task Completion Tracking**: Record of all tasks completed each day
- **Time Breakdown**: See exactly how time was distributed across tasks
- **Personal Notes**: Add daily reflections and notes
- **Productivity Scoring**: Algorithmic productivity score based on time and tasks

### Analytics & Visualization
- **Interactive Charts**: Visual representation of work patterns using Chart.js
- **Time Trends**: Track productivity patterns over time
- **Category Analysis**: See time distribution across different work categories
- **Weekly/Monthly Views**: Aggregate data for longer-term analysis
- **Filtering Options**: Filter data by date range, category, or task status

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd timeTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Development Mode
For development with automatic restart on file changes:
```bash
npm run dev
```

## 📁 Project Structure

```
timeTracker/
├── src/
│   ├── models/           # Data models
│   │   ├── Task.js       # Task model with hierarchy support
│   │   ├── TimeEntry.js  # Time tracking entries
│   │   └── DailyLog.js   # Daily activity logs
│   ├── services/         # Business logic
│   │   ├── TimeTracker.js    # Core time tracking functionality
│   │   └── TaskService.js    # Task management service
│   ├── database/         # Data persistence
│   │   └── Database.js   # SQLite database operations
│   ├── routes/          # API endpoints
│   │   ├── tasks.js     # Task CRUD operations
│   │   ├── logs.js      # Daily log endpoints
│   │   └── analytics.js # Analytics and reporting
│   └── index.js         # Main application entry point
├── public/              # Frontend files
│   ├── index.html       # Main HTML template
│   ├── style.css        # Application styles
│   └── app.js          # Frontend JavaScript
├── data/               # Database storage (created automatically)
├── package.json        # Project configuration
├── README.md          # This file
└── LICENSE            # MIT License
```

## 🖥️ User Interface

### Tasks Tab
- **Task Creation Form**: Create new tasks with all necessary metadata
- **Hierarchical Task List**: Visual tree structure showing parent-child relationships
- **Quick Actions**: Start/pause/stop time tracking directly from task list
- **Status Management**: Update task status with single click
- **Filtering Options**: Filter by status, category, or search terms

### Analytics Tab
- **Summary Cards**: Key metrics at a glance (today's time, tasks completed, etc.)
- **Time Trends Chart**: Line chart showing daily time investment
- **Category Breakdown**: Doughnut chart showing time distribution by category
- **Productivity Metrics**: Track productivity patterns over time

### Daily Logs Tab
- **Date Navigation**: Browse logs for any date
- **Daily Summary**: Time spent, tasks completed, productivity score
- **Task Lists**: Detailed view of completed and worked-on tasks
- **Personal Notes**: Add and edit daily reflections

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory for custom configuration:
```env
PORT=3000                    # Server port (default: 3000)
DB_PATH=./data/timetracker.db # Database file location
NODE_ENV=development         # Environment mode
```

### Database
The application uses SQLite for data storage, creating the database automatically on first run. Database file is stored in the `data/` directory.

## 📊 Data Models

### Task
```javascript
{
  id: "uuid",
  title: "Task title",
  description: "Detailed description",
  parentId: "parent-task-id", // null for root tasks
  category: "literature|writing|research|analysis|methodology|general",
  priority: "high|medium|low",
  status: "todo|in_progress|completed",
  estimatedTime: 120, // in minutes
  actualTime: 95,     // in minutes
  createdAt: "2023-10-01T10:00:00Z",
  updatedAt: "2023-10-01T12:00:00Z",
  completedAt: "2023-10-01T12:00:00Z", // null if not completed
  tags: ["thesis", "chapter-1"]
}
```

### Time Entry
```javascript
{
  id: "uuid",
  taskId: "task-id",
  startTime: "2023-10-01T10:00:00Z",
  endTime: "2023-10-01T11:30:00Z",
  duration: 90, // in minutes
  description: "Work session description",
  date: "2023-10-01",
  isPaused: false,
  pausedDuration: 0
}
```

### Daily Log
```javascript
{
  id: "uuid",
  date: "2023-10-01",
  totalTime: 480, // in minutes
  tasksCompleted: [
    { id: "task-id", title: "Task title" }
  ],
  tasksWorkedOn: [
    { id: "task-id", title: "Task title", timeSpent: 120 }
  ],
  notes: "Daily reflection notes",
  productivityScore: 75
}
```

## 🔗 API Endpoints

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get specific task
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/start` - Start time tracking
- `POST /api/tasks/:id/pause` - Pause time tracking
- `POST /api/tasks/:id/resume` - Resume time tracking
- `POST /api/tasks/:id/stop` - Stop time tracking

### Analytics
- `GET /api/analytics/active` - Get active time entries
- `GET /api/analytics/productivity/:startDate/:endDate` - Get productivity stats
- `GET /api/analytics/summary` - Get overall summary
- `GET /api/analytics/time-trends/:days` - Get time trends

### Daily Logs
- `GET /api/logs/:date` - Get daily log
- `PUT /api/logs/:date/notes` - Update daily notes
- `GET /api/logs/range/:startDate/:endDate` - Get logs for date range

## 🎓 Academic Use Cases

### Literature Review Management
1. Create a "Literature Review" parent task
2. Add subtasks for each paper or source
3. Track time spent reading and note-taking
4. Monitor progress with completion percentages

### Thesis Writing Organization
1. Create chapter-based parent tasks
2. Break down into section subtasks
3. Set time estimates for writing goals
4. Track actual writing productivity

### Research Project Management
1. Organize research phases as parent tasks
2. Create methodology subtasks
3. Track data collection and analysis time
4. Monitor overall project progress

## 🔒 Data Privacy

- All data is stored locally in SQLite database
- No data is transmitted to external servers
- Complete control over your academic work data
- Regular backups recommended for important data

## 🐛 Troubleshooting

### Common Issues

**Application won't start**
- Ensure Node.js is installed (v14+)
- Run `npm install` to install dependencies
- Check if port 3000 is available

**Database errors**
- Check if `data/` directory is writable
- Ensure sufficient disk space
- Restart the application

**Time tracking not working**
- Check browser console for JavaScript errors
- Ensure stable internet connection for API calls
- Try refreshing the page

### Getting Help

1. Check the browser console for error messages
2. Review the server logs in the terminal
3. Ensure all dependencies are properly installed
4. Restart the application

## 📈 Future Enhancements

- Export functionality (CSV, PDF reports)
- Calendar integration
- Mobile app version
- Cloud synchronization options
- Advanced reporting features
- Collaboration features for team projects

## 🤝 Contributing

This project is designed for personal academic use, but contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Node.js, Express.js, and SQLite
- Frontend powered by vanilla JavaScript and Chart.js
- Icons provided by Font Awesome
- Designed specifically for academic productivity

---

**Happy thesis writing! 🎓📚**

Remember: Consistent daily progress is more important than perfect planning. Use this tool to stay organized, track your productivity, and maintain momentum throughout your academic journey.