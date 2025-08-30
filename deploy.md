# Time Tracker Deployment Guide

## Prerequisites

1. **Ubuntu Server** (20.04+ recommended)
2. **Node.js** (18+ recommended)
3. **PM2** (Process manager)
4. **Nginx** (Reverse proxy)
5. **Certbot** (SSL certificates)

## Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

## Step 2: Deploy Application

```bash
# Clone or upload your application
cd /var/www
sudo mkdir timetracker
sudo chown $USER:$USER timetracker
cd timetracker

# Copy your application files here
# (Upload the entire timeTracker directory contents)

# Install dependencies
npm install --production

# Create environment file
cp .env.example .env
nano .env  # Edit with your configuration

# Create necessary directories
mkdir -p logs data data/users

# Set proper permissions
sudo chown -R $USER:www-data .
sudo chmod -R 755 .
sudo chmod -R 775 data logs
```

## Step 3: Environment Configuration

Edit your `.env` file:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secure-jwt-secret-key-min-32-characters-long
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://yourdomain.com
DATA_DIR=./data
BCRYPT_ROUNDS=12
```

## Step 4: Start with PM2

```bash
# Start the application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions provided by the command above
```

## Step 5: Nginx Configuration

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/timetracker
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Auth endpoints with stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
    }
}
```

Enable the site:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/timetracker /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 6: SSL with Let's Encrypt

```bash
# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 7: Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

## Step 8: Monitoring and Maintenance

### PM2 Monitoring

```bash
# View application status
pm2 status

# View logs
pm2 logs timetracker

# Restart application
pm2 restart timetracker

# Monitor in real-time
pm2 monit
```

### Log Rotation

```bash
# Setup log rotation
sudo nano /etc/logrotate.d/timetracker
```

Add:

```
/var/www/timetracker/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER www-data
    postrotate
        pm2 reload timetracker
    endscript
}
```

### Backup Strategy

```bash
# Create backup script
sudo nano /usr/local/bin/backup-timetracker.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/timetracker"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/timetracker"

mkdir -p $BACKUP_DIR

# Backup database and user data
tar -czf "$BACKUP_DIR/timetracker_data_$DATE.tar.gz" "$APP_DIR/data"

# Keep only last 30 backups
find $BACKUP_DIR -name "timetracker_data_*.tar.gz" -mtime +30 -delete
```

Make executable and add to cron:

```bash
sudo chmod +x /usr/local/bin/backup-timetracker.sh
sudo crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-timetracker.sh
```

## Step 9: Security Hardening

### System Updates

```bash
# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### Fail2Ban for Brute Force Protection

```bash
sudo apt install fail2ban

# Create custom jail for nginx
sudo nano /etc/fail2ban/jail.local
```

Add:

```ini
[nginx-req-limit]
enabled = true
filter = nginx-req-limit
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
```

## Step 10: Testing

1. **Test the application**: Visit https://yourdomain.com
2. **Test user registration**: Create a new account
3. **Test login**: Login with created account
4. **Test functionality**: Create tasks, track time
5. **Test SSL**: Verify HTTPS works correctly
6. **Test performance**: Use tools like GTmetrix or PageSpeed Insights

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs timetracker

# Check Node.js version
node --version

# Check environment variables
pm2 show timetracker
```

### Database Issues

```bash
# Check data directory permissions
ls -la data/

# Check SQLite files
ls -la data/users/*/
```

### Nginx Issues

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx configuration
sudo nginx -t
```

## Maintenance Commands

```bash
# Application updates
cd /var/www/timetracker
git pull  # if using git
npm install --production
pm2 restart timetracker

# System maintenance
sudo apt update && sudo apt upgrade -y
pm2 update
sudo certbot renew
```

## Security Best Practices

1. **Regular Updates**: Keep system and dependencies updated
2. **Strong Passwords**: Use strong JWT secrets and user passwords
3. **Backups**: Regular automated backups of user data
4. **Monitoring**: Set up monitoring and alerting
5. **Logs**: Regular log analysis for suspicious activity
6. **Firewall**: Keep firewall configured properly
7. **SSL**: Ensure SSL certificates are always valid

Your Time Tracker is now deployed and ready for production use!