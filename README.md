# Time Tracker - Master's Thesis Assistant

A comprehensive hierarchical time tracking system designed specifically for managing master's thesis work and university tasks. This application provides a complete solution for task management, time tracking, productivity analysis, and data export with a focus on academic work organization.

## 🎯 Key Features

### 📋 Hierarchical Task Management
- **Tree Structure**: Organize tasks with unlimited parent-child relationships
- **Smart Subtask Creation**: Add subtasks directly from parent tasks (no dropdown confusion)
- **Category System**: Literature Review, Writing, Research, Analysis, Methodology, General
- **Priority Management**: High, Medium, Low priority with visual indicators  
- **Status Tracking**: Todo, In Progress, Completed with automatic transitions
- **Deadline Management**: Optional deadlines with overdue detection and alerts
- **Time Estimation**: Set estimated vs actual time tracking with progress bars

### ⏱️ Advanced Time Tracking
- **Single Active Session**: Only one task can be tracked at a time (prevents confusion)
- **Start/Stop Control**: Clear "Start Working" and "Stop Working" buttons per task
- **Live Updates**: Real-time UI updates across all tabs and views
- **Parent Time Accumulation**: Subtask time automatically rolls up to parent tasks  
- **Visual Indicators**: Active tasks highlighted with green borders and "Working" badges
- **Automatic Daily Logging**: All work sessions saved with comprehensive metadata

### 📊 Professional Analytics Dashboard
- **Multiple Time Periods**: Last Week, Month, Year, or All Time analysis
- **Flexible Grouping**: View data by Daily, Weekly, or Monthly periods
- **Interactive Charts**: Dual-axis charts showing time + task completion
- **Category Breakdown**: Visual pie charts and detailed time distribution  
- **Productivity Scoring**: Algorithm-based productivity metrics and trends
- **Detailed Statistics**: Comprehensive tables with period summaries

### 🚨 Deadline Management
- **Deadline Overview Tab**: Dedicated view for deadline management
- **Smart Categorization**: Overdue, Due Tomorrow, Due This Week sections
- **Visual Warnings**: Color-coded deadline indicators (red=overdue, orange=soon)
- **Quick Actions**: Start/stop work and complete tasks directly from deadline view

### 📄 Excel Data Export  
- **Tasks Export**: Complete task database with hierarchy, deadlines, and progress
- **Time Entries Export**: Detailed work logs with daily summaries (multi-sheet)
- **Professional Format**: Ready for thesis progress reports and academic analysis
- **Smart Calculations**: Automatic time conversions, productivity metrics

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher) - [Download here](https://nodejs.org/)
- npm (comes with Node.js)

### Easy Installation & Startup

#### Option 1: Automated Scripts (Recommended)

**Linux/Mac:**
```bash
# Make scripts executable (one-time setup)
chmod +x start.sh stop.sh

# Start Time Tracker (installs dependencies, starts server, opens browser)
./start.sh

# Stop Time Tracker when done
./stop.sh
```

**Windows:**
```cmd
REM Start Time Tracker (installs dependencies, starts server, opens browser)
start.bat

REM Stop Time Tracker when done  
stop.bat
```

#### Option 2: Manual Installation

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

### Reset Database
To start with a clean database:
```bash
npm run reset
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

### 📋 Tasks Tab
- **Smart Task Creation**: Create tasks with deadlines, categories, priorities
- **Hierarchical Display**: Visual tree structure with expandable parent-child relationships
- **Inline Subtask Creation**: Add subtasks directly with "Add Subtask" buttons (no confusing dropdowns)
- **Visual Status Tracking**: Color-coded priority borders, deadline warnings, working indicators
- **One-Click Actions**: Start/stop work, complete tasks, manage status directly from task cards

### 🚨 Deadlines Tab  
- **Overdue Tasks**: Red-highlighted tasks past their deadline with day counts
- **Due Tomorrow**: Orange-highlighted tasks requiring immediate attention
- **Due This Week**: Blue-highlighted tasks needing planning within 7 days
- **Quick Actions**: Start work or complete tasks directly from deadline overview

### 📊 Analytics Tab
- **Period Controls**: Switch between Last Week, Month, Year, or All Time analysis
- **Chart Grouping**: View data by Daily, Weekly, or Monthly aggregation
- **Interactive Charts**: Dual-axis line/bar charts showing time AND task completion
- **Export Controls**: One-click Excel export for Tasks and Time Entries
- **Detailed Statistics**: Professional tables with category breakdowns and productivity scores

### 📖 Daily Logs Tab
- **Date Navigation**: Browse any date with calendar picker
- **Daily Summaries**: Time worked, tasks completed, productivity score
- **Task Lists**: Separate views for completed vs worked-on tasks
- **Personal Notes**: Add reflections and notes for each day
- **Real-time Updates**: Logs update automatically as you work

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

### Task Management
- `GET /api/tasks` - Get all tasks with hierarchy
- `GET /api/tasks/:id` - Get specific task with children
- `POST /api/tasks` - Create new task
- `POST /api/tasks/:id/subtask` - Create subtask for parent
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task (and children)

### Time Tracking  
- `POST /api/tasks/:id/start` - Start time tracking (stops others)
- `POST /api/tasks/:id/stop` - Stop time tracking
- `GET /api/analytics/active` - Get currently active time entries

### Analytics & Reporting
- `GET /api/analytics/summary?period=week|month|year|all` - Flexible summary stats
- `GET /api/analytics/time-trends-enhanced?period=day|week|month&duration=week|month|year|all` - Advanced time trends
- `GET /api/analytics/productivity?startDate=...&endDate=...&period=day` - Detailed productivity analysis

### Deadline Management
- `GET /api/analytics/deadlines` - Get overdue, due tomorrow, due this week tasks

### Data Export
- `GET /api/analytics/export/tasks` - Download Excel file with all tasks
- `GET /api/analytics/export/time-entries` - Download Excel file with all time entries

### Daily Logs
- `GET /api/logs/:date` - Get daily log
- `PUT /api/logs/:date/notes` - Update daily notes
- `GET /api/logs/range/:startDate/:endDate` - Get logs for date range

## 🎓 Academic Use Cases

### Master's Thesis Organization
```
📚 Master's Thesis (Parent Task)
├── 📖 Literature Review
│   ├── 📄 Paper 1: Neural Networks in NLP
│   ├── 📄 Paper 2: Transformer Architecture  
│   └── 📄 Paper 3: BERT Applications
├── ✍️ Chapter 1: Introduction
│   ├── 📝 Problem Statement
│   ├── 📝 Research Questions
│   └── 📝 Thesis Structure
├── 🔬 Chapter 2: Methodology
│   ├── 📊 Data Collection Design
│   ├── 🧪 Experimental Setup
│   └── 📈 Analysis Framework
└── 📊 Chapter 3: Results & Analysis
```

### Workflow Examples

**Literature Review Management:**
1. Create "Literature Review" parent task with deadline
2. Add subtask for each paper with estimated reading time
3. Start work timer when reading, automatic time accumulation to parent
4. Use deadline tab to track paper review deadlines
5. Export progress reports for supervisor meetings

**Daily Research Routine:**
1. Check Deadlines tab every morning for urgent tasks
2. Start timer on current task (automatically stops others)
3. Working indicator shows active task across all views
4. Daily log automatically tracks completed work
5. Use Analytics tab to review weekly productivity patterns

**Thesis Defense Preparation:**
1. Create "Defense Preparation" with presentation subtasks
2. Set deadline 2 weeks before defense date  
3. Track practice session times and slide preparation
4. Export time entries for academic progress documentation

## 🔒 Data Privacy

- All data is stored locally in SQLite database
- No data is transmitted to external servers
- Complete control over your academic work data
- Regular backups recommended for important data

## 📄 Excel Export Details

### Tasks Export (`tasks-export-YYYY-MM-DD.xlsx`)
Complete task database including:
- **Task Information**: ID, Title, Description, Category, Priority, Status
- **Time Data**: Estimated Time, Actual Time, Total Time (with subtask accumulation)
- **Deadline Management**: Deadline dates, overdue status, days until deadline
- **Hierarchy Data**: Parent Task IDs, subtask counts, progress percentages  
- **Metadata**: Creation dates, completion dates, last updated timestamps

### Time Entries Export (`time-entries-export-YYYY-MM-DD.xlsx`)
Detailed work session logs with two sheets:
- **Sheet 1 - Time Entries**: Every work session with start/end times, durations, task details
- **Sheet 2 - Daily Summary**: Aggregated daily statistics, total hours, categories worked
- **Advanced Grouping**: Week numbers, month codes, year data for analysis
- **Smart Calculations**: Automatic time conversions, productivity metrics

Perfect for:
- 📊 Supervisor progress meetings
- 📈 Academic progress reports  
- 📋 Thesis timeline documentation
- 🎯 Personal productivity analysis

## 🐛 Troubleshooting

### Quick Fixes

**Application won't start:**
- Use the automated scripts: `./start.sh` (Linux/Mac) or `start.bat` (Windows)
- Ensure Node.js is installed: [nodejs.org](https://nodejs.org/)
- Try: `npm run reset` to clean database, then restart

**Port already in use:**
- Use stop script: `./stop.sh` or `stop.bat` 
- Or manually: `lsof -i :3000` then `kill <PID>`

**Live updates not working:**
- Refresh browser page (Ctrl+F5 or Cmd+Shift+R)
- Check browser console for JavaScript errors
- Ensure stable internet connection

**Export not working:**
- Check if `xlsx` dependency is installed: `npm install`
- Ensure browser allows downloads from localhost
- Try different browser if download fails

### Getting Help
1. Check browser console (F12) for error messages
2. Review server logs in `logs/server.log` 
3. Try database reset: `npm run reset`
4. Restart with automated scripts

## 🚀 Advanced Features

### Real-Time Updates
- ✅ **Live UI Sync**: All tabs update automatically when you make changes
- ✅ **Background Refresh**: Data refreshes every 2 minutes to stay current
- ✅ **Smart Loading**: Visual indicators during operations
- ✅ **Graceful Shutdown**: Automatic time tracking save when stopping server

### Professional Analytics
- ✅ **Multi-Period Analysis**: Week, Month, Year, or All Time views
- ✅ **Flexible Grouping**: Daily, Weekly, Monthly data aggregation
- ✅ **Interactive Charts**: Dual-axis charts with time and task completion
- ✅ **Export Ready**: Professional Excel reports for academic use

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

## 🎯 **Complete Feature Summary**

✅ **Hierarchical Task Management** with unlimited nesting  
✅ **Smart Time Tracking** with single active session enforcement  
✅ **Advanced Deadline Management** with visual warnings  
✅ **Professional Analytics Dashboard** with multiple time periods  
✅ **Excel Data Export** for academic reporting  
✅ **Real-Time Live Updates** across all views  
✅ **Cross-Platform Scripts** for easy startup/shutdown  
✅ **Academic Workflow Optimization** designed for thesis work

**Perfect for:**
- 🎓 Master's & PhD thesis management
- 📚 Research project organization  
- 📊 Academic progress reporting
- ⏰ Daily productivity tracking
- 📈 Long-term work pattern analysis

---

**Happy thesis writing! 🎓📚**

*Remember: Consistent daily progress is more important than perfect planning. Use this tool to stay organized, track your productivity, and maintain momentum throughout your academic journey.*