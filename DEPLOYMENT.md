# Deployment Guide

## Simple Deployment (Recommended)

### With Domain Name (Full SSL Setup)
```bash
git clone <repo-url> timetracker
cd timetracker
./deploy.sh yourdomain.com your-email@example.com
```
- Installs Node.js, PM2, Nginx, Certbot
- Sets up SSL certificates 
- Access: https://yourdomain.com

### IP Address Only (No SSL)
```bash
git clone <repo-url> timetracker
cd timetracker
./deploy.sh    # Defaults to IP-only setup
```
- Installs Node.js, PM2 (skips Nginx/SSL)
- Access: http://your-server-ip:3000
- Perfect when you don't have a domain yet

## Local Development

```bash
git clone <repo-url> timetracker  
cd timetracker
./start.sh                        # Linux/Mac
# or start.bat                     # Windows
```

## Management Commands

After deployment, use these commands:

```bash
# Application control
sudo timetracker-start           # Start
sudo timetracker-stop            # Stop  
sudo timetracker-restart         # Restart
sudo timetracker-status          # Check status
sudo timetracker-update          # Update from git
sudo timetracker-backup          # Manual backup

# Monitoring
sudo -u timetracker pm2 logs timetracker    # View logs
sudo -u timetracker pm2 monit               # Monitor performance
```

## Manual Deployment (Advanced)

If you need custom configuration:

### 1. System Setup
```bash
# Install dependencies
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

### 2. Application Setup  
```bash
# Deploy to /opt/timetracker
sudo mkdir -p /opt/timetracker
sudo cp -r . /opt/timetracker/
cd /opt/timetracker
sudo npm install --production

# Create service user
sudo useradd -r -s /bin/false -d /opt/timetracker timetracker
sudo chown -R timetracker:timetracker /opt/timetracker
```

### 3. Environment Configuration
```bash
# Create .env file
sudo tee /opt/timetracker/.env > /dev/null <<EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://yourdomain.com
EOF
```

### 4. Process Management
```bash
# Start with PM2
cd /opt/timetracker
sudo -u timetracker pm2 start ecosystem.config.js --env production
sudo -u timetracker pm2 save
pm2 startup systemd -u timetracker --hp /opt/timetracker | sudo bash
```

### 5. Nginx Configuration
```bash
# Create nginx config
sudo tee /etc/nginx/sites-available/timetracker > /dev/null <<EOF
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/timetracker /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com --non-interactive --agree-tos --email your-email@example.com
```

## Troubleshooting

### Common Issues

**Application won't start:**
```bash
sudo timetracker-status              # Check status
sudo -u timetracker pm2 logs         # Check logs
sudo systemctl status nginx          # Check nginx
```

**SSL certificate issues:**
```bash
sudo certbot certificates            # List certificates
sudo certbot renew                   # Renew certificates
```

**Reset deployment:**
```bash
sudo timetracker-stop
sudo -u timetracker pm2 delete all
sudo rm -rf /opt/timetracker
sudo userdel timetracker
# Then redeploy
```

## Security

The deployment includes:
- Secure service user (non-login)
- SSL/TLS encryption
- Rate limiting
- Firewall configuration
- Automatic security headers
- Generated JWT secrets

## Backup

- Automatic daily backups at 2 AM
- 30-day retention policy
- Manual backup: `sudo timetracker-backup`
- Backup location: `/var/backups/timetracker/`