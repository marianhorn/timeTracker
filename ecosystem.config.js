// PM2 Configuration for Production Deployment
module.exports = {
  apps: [{
    name: 'timetracker',
    script: 'src/index.js',
    instances: 1, // Or 'max' for cluster mode
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Error and output logs
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Advanced settings
    min_uptime: '10s',
    max_restarts: 5,
    
    // Environment variables from .env file
    env_file: '.env'
  }]
};