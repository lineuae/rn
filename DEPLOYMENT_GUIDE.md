# 🚀 DEPLOYMENT GUIDE - Discord Selfbot Video Stream

## 📋 Prerequisites

- VPS with Ubuntu/Debian
- Node.js v22+ installed
- PM2 installed globally (`npm install -g pm2`)
- MongoDB Atlas account (or local MongoDB)
- Discord selfbot token
- Git installed

---

## 🔧 Initial VPS Setup

### 1. Create User

```bash
# As root
adduser discord-bot
usermod -aG sudo discord-bot
su - discord-bot
```

### 2. Install Node.js

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js 22
nvm install 22
nvm use 22
node --version  # Should show v22.x.x
```

### 3. Install PM2

```bash
npm install -g pm2
pm2 startup  # Follow the instructions
```

---

## 📥 Project Installation

### 1. Clone Repository

```bash
cd ~
mkdir projects
cd projects
git clone https://github.com/lineuae/rn.git
cd rn/examples/basic
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Bot

```bash
cd src
cp config.example.json config.json
nano config.json
```

**Edit config.json:**

```json
{
    "token": "YOUR_DISCORD_SELFBOT_TOKEN",
    "acceptedAuthors": ["YOUR_USER_ID"],
    "mongo_uri": "mongodb+srv://username:password@cluster.mongodb.net/dbname",
    "streamOpts": {
        "width": 1280,
        "height": 720,
        "fps": 30,
        "bitrateKbps": 1000,
        "maxBitrateKbps": 2500,
        "hardware_acceleration": false,
        "videoCodec": "H264"
    }
}
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`

### 4. Build Project

```bash
cd ~/projects/rn/examples/basic
npm run build
# postbuild will automatically copy src/config.json to dist/config.json
```

### 5. (Optional) Manually Copy Config to dist/

```bash
# Only needed if dist/config.json is missing for some reason
cp src/config.json dist/config.json
```

### 6. Start with PM2

```bash
pm2 start dist/index.js --name discord-bot
pm2 save
```

### 7. Verify Bot is Running

```bash
pm2 logs discord-bot --lines 50
```

You should see at least:
```
[✓] Bot ready: YourUsername
[✓] MongoDB connected
```

---

## 🔄 Update Procedure

### Standard Update

```bash
# 1. Navigate to project
cd ~/projects/rn/examples/basic

# 2. Pull latest changes
git pull origin main

# 3. Install new dependencies (if any)
npm install

# 4. Clean build
rm -rf dist/
npm run build   # postbuild copies config.json automatically

# 5. (Optional) Copy config if needed
[ -f dist/config.json ] || cp src/config.json dist/config.json

# 6. Restart bot
pm2 restart discord-bot

# 7. Check logs
pm2 logs discord-bot --lines 50
```

### Update with Conflicts

```bash
# If git pull fails due to local changes
git stash
git pull origin main
git stash drop  # Or git stash pop if you need local changes

# Continue with standard update
npm install
rm -rf dist/
npm run build
cp src/config.json dist/config.json
pm2 restart discord-bot
```

---

## 🔍 Verification Steps

### 1. Check Bot Status

```bash
pm2 status
```

Should show:
```
┌─────┬──────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ mode        │ ↺       │ status  │ cpu      │
├─────┼──────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ discord-bot  │ fork        │ 0       │ online  │ 0%       │
└─────┴──────────────┴─────────────┴─────────┴─────────┴──────────┘
```

### 2. Verify Logs

```bash
pm2 logs discord-bot --lines 100
```

Look for:
- ✅ `[STARTUP] Bot script starting...`
- ✅ `[STARTUP] Login successful!`
- ✅ `[READY] Bot is ready:`
- ✅ `[MONGODB] Connected successfully!`
- ✅ `[SESSION] Bot initialization complete!`

### 3. Test Commands

In Discord, send:
- `$join <channel_id>` - Should join voice channel
- `$mute` - Should mute bot
- `$clear 5` - Should delete 5 messages

Recommended additional checks:
- `$help` - Command list (auto-deletes after 30 seconds)
- `$uptime` - Bot status summary
- `$health` - System health summary
- `$autovoc <channel_id>` - Enable AutoVoc on a voice channel
- `$gs` - Verify GS help text appears

---

## 🐛 Troubleshooting

### Bot Won't Start

```bash
# Check logs for errors
pm2 logs discord-bot --lines 100 --err

# Common issues:
# 1. TOKEN_INVALID - Update token in dist/config.json
# 2. mongo_uri MISSING - Add to dist/config.json
# 3. Module not found - Run npm install
```

### Config Not Found

```bash
# Verify config exists in dist/
cat dist/config.json

# If missing, copy from src/
cp src/config.json dist/config.json
pm2 restart discord-bot
```

### MongoDB Connection Failed

```bash
# Check logs
pm2 logs discord-bot | grep MONGODB

# Verify mongo_uri in config
cat dist/config.json | grep mongo_uri

# Test connection manually
mongosh "YOUR_MONGO_URI"
```

### Compilation Errors

```bash
# Clean rebuild
cd ~/projects/rn/examples/basic
rm -rf dist/ node_modules/
npm install
npm run build

# Check for TypeScript errors
npm run build 2>&1 | tee build.log
cat build.log
```

---

## 🔐 Security Best Practices

### 1. Secure Config File

```bash
# Set proper permissions
chmod 600 src/config.json
chmod 600 dist/config.json
```

### 2. Use Environment Variables (Optional)

Create `.env` file:
```bash
DISCORD_TOKEN=your_token_here
MONGO_URI=your_mongo_uri_here
```

Modify code to read from environment variables.

### 3. Firewall Configuration

```bash
# Allow only SSH
sudo ufw allow 22/tcp
sudo ufw enable
```

---

## 📊 Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs discord-bot

# View specific log file
tail -f ~/.pm2/logs/discord-bot-out.log
tail -f ~/.pm2/logs/discord-bot-error.log
```

### Restart Options

You can restart the bot in two ways:

1. On the VPS:
```bash
pm2 restart discord-bot
```

2. From Discord (authorized user only):
```text
$restart
```
This exits the Node.js process and PM2 will restart it.

### Set Up Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 🔄 Backup & Recovery

### Backup Config

```bash
# Backup config file
cp ~/projects/rn/examples/basic/src/config.json ~/config.backup.json
```

### Full Recovery

```bash
# 1. Fresh clone
cd ~/projects
rm -rf rn
git clone https://github.com/lineuae/rn.git
cd rn/examples/basic

# 2. Restore config
cp ~/config.backup.json src/config.json

# 3. Build and start
npm install
npm run build
cp src/config.json dist/config.json
pm2 delete discord-bot
pm2 start dist/index.js --name discord-bot
pm2 save
```

---

## 🎯 Performance Optimization

### 1. Enable PM2 Cluster Mode (Optional)

```bash
pm2 delete discord-bot
pm2 start dist/index.js --name discord-bot -i 1
pm2 save
```

### 2. Set Memory Limit

```bash
pm2 start dist/index.js --name discord-bot --max-memory-restart 500M
pm2 save
```

### 3. Auto-Restart on Crash

```bash
pm2 start dist/index.js --name discord-bot --exp-backoff-restart-delay=100
pm2 save
```

---

## 📝 Maintenance Schedule

### Daily
- Check bot status: `pm2 status`
- Review logs: `pm2 logs discord-bot --lines 50`

### Weekly
- Update dependencies: `npm update`
- Check for security updates: `npm audit`
- Review MongoDB storage usage

### Monthly
- Full system update: `sudo apt update && sudo apt upgrade`
- Backup configuration files
- Review and clean old logs

---

## 🆘 Emergency Contacts

### Bot Issues
- GitHub Issues: https://github.com/lineuae/rn/issues
- Check PROJECT_DOCUMENTATION.md for detailed troubleshooting

### VPS Issues
- Contabo Support: https://contabo.com/support/
- Server: vmi3077908.contaboserver.net

---

**📌 Keep this guide updated with any deployment changes!**

**Last Updated:** February 27, 2026
