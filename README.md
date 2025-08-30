# Time Tracker

A hierarchical time tracking system for academic work and thesis management.

## Features

- **Hierarchical Task Management** - Organize tasks with parent-child relationships
- **Time Tracking** - Start/stop timers with single active session enforcement
- **Deadline Management** - Track deadlines with overdue/due soon alerts
- **Analytics Dashboard** - Charts and reports for productivity analysis
- **Excel Export** - Professional reports for progress meetings
- **Multi-user Support** - Login system with isolated user databases

## Quick Start

### Local Development
```bash
# Clone and start
git clone <repo-url> timetracker
cd timetracker
./start.sh          # Linux/Mac
# or start.bat       # Windows

# Access: http://localhost:3000
# Stop: ./stop.sh or stop.bat
```

### Server Deployment

**With Domain (SSL + Nginx):**
```bash
git clone <repo-url> timetracker
cd timetracker
./deploy.sh yourdomain.com your-email@example.com
# Access: https://yourdomain.com
```

**IP Only (No SSL):**
```bash
git clone <repo-url> timetracker
cd timetracker
./deploy.sh    # or ./deploy.sh 192.168.1.100
# Access: http://your-server-ip:3000
```

## Usage

1. **Register/Login** - Create account or login
2. **Create Tasks** - Add tasks with categories, priorities, deadlines  
3. **Track Time** - Click "Start Working" to begin timing
4. **Add Subtasks** - Use "Add Subtask" buttons for hierarchy
5. **View Analytics** - Charts and exports in Analytics tab
6. **Check Deadlines** - Monitor due dates in Deadlines tab

## Project Structure

```
timeTracker/
├── src/              # Backend (Node.js/Express)
├── public/           # Frontend (HTML/CSS/JS)
├── data/             # SQLite databases
├── start.sh/bat      # Local startup scripts
├── deploy.sh         # Server deployment script
└── README.md         # This file
```

## Management Commands

After deployment:
```bash
sudo timetracker-start     # Start application
sudo timetracker-stop      # Stop application
sudo timetracker-restart   # Restart application
sudo timetracker-status    # Check status
```

## Requirements

- Node.js 18+
- Modern web browser
- Ubuntu 20.04+ (for server deployment)

## License

MIT - See LICENSE file