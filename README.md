# The Scratcher Project — Website

Static website for [The Scratcher Project](https://thescratcherproject.com).
Built with plain HTML, CSS, and a touch of vanilla JS. Deployed automatically to a private Ubuntu + Nginx server via GitHub Actions.

---

## Project structure

```
xscratcher-web/
├── index.html              # Landing page
├── about.html              # About page
├── css/
│   └── style.css
├── assets/
│   └── logo.svg
└── .github/
    └── workflows/
        └── deploy.yml      # CI/CD pipeline
```

---

## Local development

No build step needed. Open any HTML file in your browser:

```bash
# Quick local server (Python 3)
python3 -m http.server 8080
# then visit http://localhost:8080
```

Or use the **Live Server** extension in VS Code.

---

## Deployment

Pushes to the `main` branch automatically deploy via GitHub Actions → rsync over SSH.

### One-time server setup (Ubuntu)

SSH into your server and run:

```bash
# 1. Install Nginx
sudo apt update && sudo apt install -y nginx

# 2. Create the web root
sudo mkdir -p /var/www/scratcher

# 3. Create Nginx site config
sudo tee /etc/nginx/sites-available/scratcher > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/scratcher;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Optional: pretty URLs (drop .html extension)
    location ~ \.html$ {
        try_files $uri =404;
    }
}
EOF

# 4. Enable the site and reload Nginx
sudo ln -sf /etc/nginx/sites-available/scratcher /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. Set ownership so the deploy user can write files
sudo chown -R $USER:www-data /var/www/scratcher
sudo chmod -R 755 /var/www/scratcher
```

### GitHub Secrets

Add the following secrets to your GitHub repository
(**Settings → Secrets and variables → Actions → New repository secret**):

| Secret name       | Value                                         |
|-------------------|-----------------------------------------------|
| `SSH_HOST`        | Server IP address or hostname                 |
| `SSH_USER`        | SSH username on the server                    |
| `SSH_PRIVATE_KEY` | Full contents of your private key (e.g. id_ed25519) |
| `SSH_PORT`        | SSH port (omit if using default `22`)         |

**Generating a deploy key pair** (if you don't have one):

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/scratcher_deploy
# Copy public key to server:
ssh-copy-id -i ~/.ssh/scratcher_deploy.pub user@your-server
# Paste contents of ~/.ssh/scratcher_deploy into the SSH_PRIVATE_KEY secret
```

### HTTPS (optional but recommended)

Install Certbot and obtain a free Let's Encrypt certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## Customisation

- Edit copy in `index.html` and `about.html`
- Tweak colours/fonts via CSS custom properties at the top of `css/style.css`
- Replace `assets/logo.svg` with your own logo
- Update the contact email in `about.html`
