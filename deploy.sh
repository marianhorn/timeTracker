#!/bin/bash

# Time Tracker - Simple Deployment Script
# Usage: ./deploy.sh [domain] [email]
# Example: ./deploy.sh timetracker.example.com admin@example.com

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${1:-"localhost"}
EMAIL=${2:-"admin@example.com"}
APP_DIR="/opt/timetracker"
SERVICE_USER="timetracker"

# Helper functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Please run as a regular user with sudo privileges."
    fi
}

# Detect Linux distribution
detect_distro() {
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        DISTRO=$ID
        DISTRO_LIKE=$ID_LIKE
    else
        error "Cannot detect Linux distribution"
    fi
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    detect_distro
    log "Detected distribution: $DISTRO"
    
    # Update system and install Node.js based on distro
    case "$DISTRO" in
        "ubuntu"|"debian")
            sudo apt update && sudo apt upgrade -y
            if ! command -v node &> /dev/null; then
                log "Installing Node.js..."
                curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                sudo apt-get install -y nodejs
            fi
            NGINX_INSTALL_CMD="sudo apt install nginx -y"
            CERTBOT_INSTALL_CMD="sudo apt install certbot python3-certbot-nginx -y"
            ;;
        "ol"|"centos"|"rhel"|"fedora")
            sudo dnf update -y
            if ! command -v node &> /dev/null; then
                log "Installing Node.js..."
                curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
                sudo dnf install -y nodejs
            fi
            NGINX_INSTALL_CMD="sudo dnf install nginx -y"
            # Enable EPEL for certbot on Oracle Linux/RHEL/CentOS
            if [[ "$DISTRO" == "ol" ]] || [[ "$DISTRO" == "centos" ]] || [[ "$DISTRO" == "rhel" ]]; then
                CERTBOT_INSTALL_CMD="sudo dnf install -y epel-release && sudo dnf install -y certbot python3-certbot-nginx"
            else
                CERTBOT_INSTALL_CMD="sudo dnf install certbot python3-certbot-nginx -y"
            fi
            ;;
        "sles"|"opensuse"|"opensuse-leap"|"opensuse-tumbleweed")
            sudo zypper refresh && sudo zypper update -y
            if ! command -v node &> /dev/null; then
                log "Installing Node.js..."
                sudo zypper install -y nodejs18 npm18
            fi
            NGINX_INSTALL_CMD="sudo zypper install -y nginx"
            CERTBOT_INSTALL_CMD="sudo zypper install -y certbot python3-certbot-nginx"
            ;;
        *)
            if [[ "$DISTRO_LIKE" == *"fedora"* ]] || [[ "$DISTRO_LIKE" == *"rhel"* ]]; then
                log "Using dnf commands for $DISTRO (like $DISTRO_LIKE)"
                sudo dnf update -y
                if ! command -v node &> /dev/null; then
                    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
                    sudo dnf install -y nodejs
                fi
                NGINX_INSTALL_CMD="sudo dnf install nginx -y"
                CERTBOT_INSTALL_CMD="sudo dnf install certbot python3-certbot-nginx -y"
            else
                error "Unsupported distribution: $DISTRO. Please install Node.js 18+ manually."
            fi
            ;;
    esac
    
    # Check Node.js installation
    if command -v node &> /dev/null; then
        log "Node.js installed: $(node --version)"
    else
        error "Failed to install Node.js"
    fi
    
    # Install PM2
    if ! command -v pm2 &> /dev/null; then
        log "Installing PM2..."
        sudo npm install -g pm2
    else
        log "PM2 already installed: $(pm2 --version)"
    fi
    
    # Install Nginx and Certbot (only if domain is not localhost)
    if [[ "$DOMAIN" != "localhost" ]]; then
        if ! command -v nginx &> /dev/null; then
            log "Installing Nginx..."
            eval $NGINX_INSTALL_CMD
        else
            log "Nginx already installed"
        fi
        
        if ! command -v certbot &> /dev/null; then
            log "Installing Certbot..."
            eval $CERTBOT_INSTALL_CMD
        else
            log "Certbot already installed"
        fi
    fi
    
    success "System dependencies installed"
}

# Create service user
create_user() {
    if ! id "$SERVICE_USER" &>/dev/null; then
        log "Creating service user: $SERVICE_USER"
        sudo useradd -r -s /bin/false -d $APP_DIR $SERVICE_USER
    else
        log "Service user $SERVICE_USER already exists"
    fi
}

# Deploy application
deploy_app() {
    log "Deploying application to $APP_DIR..."
    
    # Create app directory
    sudo mkdir -p $APP_DIR
    
    # Copy application files
    sudo cp -r . $APP_DIR/
    cd $APP_DIR
    
    # Install dependencies
    log "Installing npm dependencies..."
    sudo npm install --production --silent
    
    # Create necessary directories
    sudo mkdir -p logs data data/users
    
    # Set ownership
    sudo chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    sudo chmod -R 755 $APP_DIR
    sudo chmod -R 775 $APP_DIR/data $APP_DIR/logs
    
    success "Application deployed"
}

# Configure environment
configure_env() {
    log "Configuring environment..."
    
    if [[ ! -f $APP_DIR/.env ]]; then
        # Generate JWT secret
        JWT_SECRET=$(openssl rand -base64 32)
        
        # Generate session secret for OAuth
        SESSION_SECRET=$(openssl rand -base64 32)
        
        # Create .env file
        sudo tee $APP_DIR/.env > /dev/null <<EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
SESSION_SECRET=$SESSION_SECRET
DATA_DIR=./data
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
AUTH_RATE_LIMIT_MAX=5

# OAuth Configuration (Google)
# To enable Google OAuth, add your credentials:
# GOOGLE_CLIENT_ID=your_google_client_id_here
# GOOGLE_CLIENT_SECRET=your_google_client_secret_here
EOF

        if [[ "$DOMAIN" != "localhost" ]]; then
            echo "ALLOWED_ORIGINS=https://$DOMAIN" | sudo tee -a $APP_DIR/.env > /dev/null
        fi
        
        sudo chown $SERVICE_USER:$SERVICE_USER $APP_DIR/.env
        sudo chmod 600 $APP_DIR/.env
        success "Environment configured"
    else
        log "Environment file already exists"
    fi
}

# Configure PM2
configure_pm2() {
    log "Configuring PM2..."
    
    # Stop existing processes
    sudo -u $SERVICE_USER pm2 delete timetracker 2>/dev/null || true
    
    # Start application
    cd $APP_DIR
    sudo -u $SERVICE_USER pm2 start ecosystem.config.js --env production
    sudo -u $SERVICE_USER pm2 save
    
    # Setup PM2 startup (as root)
    pm2 startup systemd -u $SERVICE_USER --hp $APP_DIR | sudo bash || warn "PM2 startup configuration may need manual setup"
    
    success "PM2 configured"
}

# Configure Nginx (only for non-localhost)
configure_nginx() {
    if [[ "$DOMAIN" == "localhost" ]]; then
        log "Skipping Nginx configuration for localhost"
        return
    fi
    
    log "Configuring Nginx for domain: $DOMAIN"
    
    detect_distro
    
    # Different nginx config paths for different distros
    if [[ "$DISTRO" == "ubuntu" ]] || [[ "$DISTRO" == "debian" ]]; then
        # Debian/Ubuntu style
        NGINX_CONFIG_PATH="/etc/nginx/sites-available/timetracker"
        NGINX_ENABLE_CMD="sudo ln -sf /etc/nginx/sites-available/timetracker /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default"
    else
        # RHEL/CentOS/Oracle Linux style
        NGINX_CONFIG_PATH="/etc/nginx/conf.d/timetracker.conf"
        NGINX_ENABLE_CMD="sudo systemctl enable nginx"
    fi
    
    # Create Nginx config
    sudo tee $NGINX_CONFIG_PATH > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Enable site (different methods for different distros)
    eval $NGINX_ENABLE_CMD
    
    # Enable SELinux permissions for nginx proxy (RHEL/CentOS/Oracle Linux)
    if [[ "$DISTRO" != "ubuntu" ]] && [[ "$DISTRO" != "debian" ]]; then
        log "Configuring SELinux for nginx proxy..."
        sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || warn "Could not configure SELinux (not critical)"
    fi
    
    # Test and start/reload Nginx
    sudo nginx -t && sudo systemctl start nginx && sudo systemctl reload nginx
    
    success "Nginx configured"
}

# Setup SSL
setup_ssl() {
    if [[ "$DOMAIN" == "localhost" ]]; then
        return
    fi
    
    log "Setting up SSL certificate for $DOMAIN..."
    
    # Check if certificate already exists
    if sudo certbot certificates | grep -q "$DOMAIN"; then
        log "SSL certificate already exists for $DOMAIN"
    else
        # Obtain certificate
        sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect
    fi
    
    # Ensure nginx config has proper HTTPS setup
    detect_distro
    if [[ "$DISTRO" == "ubuntu" ]] || [[ "$DISTRO" == "debian" ]]; then
        NGINX_CONFIG_PATH="/etc/nginx/sites-available/timetracker"
    else
        NGINX_CONFIG_PATH="/etc/nginx/conf.d/timetracker.conf"
    fi
    
    # Verify SSL configuration exists, if not create it
    if ! grep -q "listen 443" $NGINX_CONFIG_PATH; then
        log "Adding HTTPS configuration to nginx..."
        
        # Backup current config
        sudo cp $NGINX_CONFIG_PATH ${NGINX_CONFIG_PATH}.backup
        
        # Create complete HTTP + HTTPS config
        sudo tee $NGINX_CONFIG_PATH > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\\\$server_name\\\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
    }
}
EOF
        
        # Test and reload nginx
        sudo nginx -t && sudo systemctl reload nginx
    fi
    
    # Test auto-renewal
    sudo certbot renew --dry-run 2>/dev/null || warn "SSL auto-renewal test failed (not critical)"
    
    success "SSL configured"
}

# Configure firewall
configure_firewall() {
    if [[ "$DOMAIN" == "localhost" ]]; then
        return
    fi
    
    log "Configuring firewall..."
    
    detect_distro
    
    if [[ "$DISTRO" == "ubuntu" ]] || [[ "$DISTRO" == "debian" ]]; then
        # Ubuntu/Debian - use ufw
        if ! sudo ufw status | grep -q "Status: active"; then
            sudo ufw --force enable
        fi
        sudo ufw allow ssh
        sudo ufw allow 'Nginx Full'
    else
        # RHEL/CentOS/Oracle Linux - use firewalld
        if ! sudo systemctl is-active --quiet firewalld; then
            sudo systemctl start firewalld
            sudo systemctl enable firewalld
        fi
        
        # Allow SSH (should already be open)
        sudo firewall-cmd --permanent --add-service=ssh
        
        # Allow HTTP and HTTPS
        sudo firewall-cmd --permanent --add-service=http
        sudo firewall-cmd --permanent --add-service=https
        
        # Reload firewall
        sudo firewall-cmd --reload
    fi
    
    success "Firewall configured"
}

# Create management scripts
create_scripts() {
    log "Creating management scripts..."
    
    # Start script
    sudo tee /usr/local/bin/timetracker-start > /dev/null <<EOF
#!/bin/bash
cd $APP_DIR
sudo -u $SERVICE_USER pm2 start ecosystem.config.js --env production
echo "Time Tracker started"
EOF
    
    # Stop script
    sudo tee /usr/local/bin/timetracker-stop > /dev/null <<EOF
#!/bin/bash
sudo -u $SERVICE_USER pm2 stop timetracker
echo "Time Tracker stopped"
EOF
    
    # Restart script
    sudo tee /usr/local/bin/timetracker-restart > /dev/null <<EOF
#!/bin/bash
cd $APP_DIR
sudo -u $SERVICE_USER pm2 restart timetracker
echo "Time Tracker restarted"
EOF
    
    # Status script
    sudo tee /usr/local/bin/timetracker-status > /dev/null <<EOF
#!/bin/bash
sudo -u $SERVICE_USER pm2 status timetracker
EOF
    
    # Update script
    sudo tee /usr/local/bin/timetracker-update > /dev/null <<EOF
#!/bin/bash
cd $APP_DIR
git pull origin main
sudo npm install --production
sudo -u $SERVICE_USER pm2 restart timetracker
echo "Time Tracker updated"
EOF
    
    # Make scripts executable
    sudo chmod +x /usr/local/bin/timetracker-*
    
    success "Management scripts created"
}

# Create backup script
create_backup() {
    log "Setting up automated backups..."
    
    sudo tee /usr/local/bin/timetracker-backup > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/timetracker"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/timetracker"

mkdir -p $BACKUP_DIR
tar -czf "$BACKUP_DIR/timetracker_data_$DATE.tar.gz" "$APP_DIR/data"
find $BACKUP_DIR -name "timetracker_data_*.tar.gz" -mtime +30 -delete

echo "Backup completed: timetracker_data_$DATE.tar.gz"
EOF
    
    sudo chmod +x /usr/local/bin/timetracker-backup
    
    # Add to crontab for daily backups at 2 AM
    (sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/timetracker-backup") | sudo crontab -
    
    success "Backup system configured"
}

# Main deployment function
main() {
    echo "=================================================="
    echo "  Time Tracker - Simplified Deployment Script"
    echo "=================================================="
    echo "Domain: $DOMAIN"
    echo "Email: $EMAIL"
    echo "=================================================="
    
    check_root
    install_dependencies
    create_user
    deploy_app
    configure_env
    configure_pm2
    configure_nginx
    setup_ssl
    configure_firewall
    create_scripts
    create_backup
    
    echo ""
    echo "=================================================="
    success "Time Tracker deployed successfully!"
    echo "=================================================="
    
    if [[ "$DOMAIN" == "localhost" ]]; then
        echo "🌐 Access your application at: http://localhost:3000"
    else
        echo "🌐 Access your application at: https://$DOMAIN"
    fi
    
    echo ""
    echo "📋 Management Commands:"
    echo "  Start:   sudo timetracker-start"
    echo "  Stop:    sudo timetracker-stop"
    echo "  Restart: sudo timetracker-restart"
    echo "  Status:  sudo timetracker-status"
    echo "  Update:  sudo timetracker-update"
    echo "  Backup:  sudo timetracker-backup"
    
    echo ""
    echo "📊 Application Status:"
    sudo -u $SERVICE_USER pm2 status timetracker || warn "Could not get PM2 status"
    
    echo ""
    echo "🔐 First Steps:"
    echo "1. Visit your application URL"
    echo "2. Register a new account or setup Google OAuth (see below)"
    echo "3. Start tracking your time!"
    
    echo ""
    echo "🔑 OAuth Setup (Optional):"
    echo "To enable Google OAuth login:"
    echo "1. Get credentials from Google Cloud Console"
    echo "2. Edit $APP_DIR/.env and add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    echo "3. Restart: sudo timetracker-restart"
    echo "4. See OAUTH_SETUP.md for detailed instructions"
    
    if [[ "$DOMAIN" != "localhost" ]]; then
        echo ""
        echo "🔧 Server Management:"
        echo "  View logs: sudo -u $SERVICE_USER pm2 logs timetracker"
        echo "  Monitor:   sudo -u $SERVICE_USER pm2 monit"
        echo "  Nginx:     sudo systemctl status nginx"
    fi
}

# Parse command line arguments
case "${1}" in
    --help|-h|help)
        echo "Usage: $0 [domain] [email]"
        echo ""
        echo "Examples:"
        echo "  $0                              # Deploy locally (localhost)"
        echo "  $0 timetracker.example.com      # Deploy with domain"
        echo "  $0 example.com admin@example.com # Deploy with domain and email"
        echo ""
        echo "For localhost deployment, Nginx and SSL will be skipped."
        echo "For domain deployment, make sure DNS points to this server."
        exit 0
        ;;
    *)
        main
        ;;
esac