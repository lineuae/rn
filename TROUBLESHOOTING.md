# 🔧 TROUBLESHOOTING GUIDE - Discord Selfbot Video Stream

## 🚨 Common Issues & Solutions

---

## 1️⃣ Bot Won't Start

### Symptom
```
pm2 status
# Shows: status: errored or stopped
```

### Diagnosis
```bash
pm2 logs discord-bot --lines 100 --err
```

### Solutions

#### A. TOKEN_INVALID Error
```
Error [TOKEN_INVALID]: An invalid token was provided.
```

**Fix:**
```bash
cd ~/projects/rn/examples/basic
nano dist/config.json
# Update the "token" field with valid Discord token
pm2 restart discord-bot
```

#### B. Module Not Found
```
Error: Cannot find module 'mongodb'
```

**Fix:**
```bash
cd ~/projects/rn/examples/basic
npm install
pm2 restart discord-bot
```

#### C. Config File Missing
```
Error: Cannot find module './config.json'
```

**Fix:**
```bash
cd ~/projects/rn/examples/basic
# Rebuild to let postbuild copy config.json automatically
npm run build
# If dist/config.json is still missing, copy manually as fallback
cp src/config.json dist/config.json
pm2 restart discord-bot
```

---

## 2️⃣ MongoDB Connection Issues

### Symptom
```
[MONGODB] Connection failed!
hasMongoUri: false
mongoUri: 'MISSING'
```

### Diagnosis
```bash
cat dist/config.json | grep mongo_uri
```

### Solutions

#### A. mongo_uri Missing from Config
**Fix:**
```bash
cd ~/projects/rn/examples/basic
nano dist/config.json
# Add: "mongo_uri": "mongodb+srv://username:password@cluster.mongodb.net/dbname",
pm2 restart discord-bot
```

#### B. Invalid MongoDB URI
**Test connection:**
```bash
mongosh "YOUR_MONGO_URI"
```

**Fix:** Update URI in `dist/config.json` with correct credentials

#### C. MongoDB Atlas IP Whitelist
- Go to MongoDB Atlas dashboard
- Network Access → Add IP Address
- Add VPS IP or use `0.0.0.0/0` (allow all - less secure)

---

## 3️⃣ Compilation Errors

### Symptom
```bash
npm run build
# Shows TypeScript errors
```

### Common TypeScript Errors

#### A. Cannot find module 'mongodb'
```
error TS2307: Cannot find module 'mongodb'
```

**Fix:**
```bash
npm install mongodb
npm run build
```

#### B. Property 'mongo_uri' does not exist
```
error TS2339: Property 'mongo_uri' does not exist on type
```

**Fix:** Already handled in code with `(config as any).mongo_uri`

If error persists:
```bash
rm -rf node_modules dist
npm install
npm run build
```

#### C. Type 'string' is not assignable to type 'Condition<ObjectId>'
```
error TS2322: Type 'string' is not assignable to type 'Condition<ObjectId>'
```

**Fix:** Already handled with `as any` casts. If error persists, verify code matches PROJECT_DOCUMENTATION.md

---

## 4️⃣ Commands Not Working

### Symptom
Bot doesn't respond to commands like `$join`, `$clear`, etc.

### Diagnosis

#### Check 1: Bot is Online
```bash
pm2 logs discord-bot | grep READY
# Should show: [READY] Bot is ready: YourUsername
```

#### Check 2: User ID in acceptedAuthors
```bash
cat dist/config.json | grep acceptedAuthors
# Should contain your Discord user ID
```

#### Check 3: Bot Receives Messages
```bash
pm2 logs discord-bot --lines 50
# Send a command and watch logs
```

### Solutions

#### A. User Not Authorized
**Fix:**
```bash
nano dist/config.json
# Update "acceptedAuthors": ["YOUR_USER_ID"]
pm2 restart discord-bot
```

#### B. Commands in Wrong Format
- Commands must start with `$`
- Example: `$join 1234567890` not `join 1234567890`

#### C. Bot Not in Server
- Bot can only respond to messages it can see
- Ensure bot account is in the server

---

## 5️⃣ Clear Commands Not Working

### Symptom
`$clear` or `$clearall` doesn't delete messages

### Diagnosis
```bash
pm2 logs discord-bot | grep CLEAR
```

### Solutions

#### A. Permission Issues
**In DM:** Should work fine  
**In Server:** Bot needs permission to delete messages

**Fix:** Use commands in DM or ensure bot has proper permissions

#### B. Messages Too Old
Discord API limits deletion of messages older than 14 days

**Fix:** Only works on recent messages

#### C. Rate Limiting
```
[CLEAR] Failed to delete message: RateLimitError
```

**Fix:** Already handled with 300ms delay between deletions. If persists, increase delay in code.

---

## 6️⃣ Voice Connection Issues

### Symptom
Bot joins voice but disconnects immediately or can't join

### Diagnosis
```bash
pm2 logs discord-bot | grep JOIN
pm2 logs discord-bot | grep AUTOVOC
```

### Solutions

#### A. Invalid Channel ID
```
[JOIN] Channel vocal introuvable
```

**Fix:** Use correct voice channel ID from Discord

#### B. Bot Disconnects After Few Minutes
**Fix:** AutoVoc is responsible for periodic reconnection when enabled.

If AutoVoc is enabled, the bot performs a check every 10 minutes to ensure it is in the configured voice channel.

#### C. Can't Join Stage Channel
**Fix:** Bot needs to be unsuppressed in stage channels (already handled in code)

---

## 6️⃣.1 AutoVoc Not Reconnecting

### Symptom
AutoVoc is enabled but the bot is not in the configured voice channel.

### Diagnosis
Check logs:
```bash
pm2 logs discord-bot --lines 200 | grep AUTOVOC
```

### Notes
- AutoVoc is stored in MongoDB under `_id: "autovoc_state"`.
- On startup, the bot joins the configured channel.
- Every 10 minutes, the bot checks `client.user.voice.channelId` matches the saved channel.

---

## 7️⃣ Mass DM (GS) Issues

### Symptom
`$gs confirm` reports failures, or DMs are not delivered.

### Common Causes
- Recipient has DMs closed (friends-only / privacy settings)
- You are blocked by the user
- Discord rate limits (too many DMs)

### Recommendations
- Use a higher delay: `$gs delay 5000`
- Keep batches small (the bot enforces a hard limit of 50 recipients per campagne)
- Respect the global cooldown (30 minutes between two campagnes, stored in MongoDB)
- Use `$gs send` to review the recipient list and message (the confirmation message now shows limit + cooldown + warning)

---

## 8️⃣ Git Pull Issues

### Symptom
```
error: Your local changes would be overwritten by merge
```

### Solutions

#### A. Stash Local Changes
```bash
git stash
git pull origin main
git stash drop  # Or git stash pop to reapply
```

#### B. Hard Reset (Discard Local Changes)
```bash
git reset --hard HEAD
git pull origin main
```

#### C. Merge Conflicts
```bash
# View conflicted files
git status

# For config files, use remote version
git checkout --theirs src/config.json
git add src/config.json
git commit -m "Resolve conflict"
```

---

## 9️⃣ PM2 Issues

### Symptom
PM2 commands not working or bot not persisting after reboot

### Solutions

#### A. PM2 Not Installed
```bash
npm install -g pm2
```

#### B. Bot Doesn't Start on Reboot
```bash
pm2 startup
# Follow the instructions (copy-paste the command it gives)
pm2 save
```

#### C. PM2 Shows Old Code
```bash
pm2 delete discord-bot
pm2 start dist/index.js --name discord-bot
pm2 save
```

---

## 🔟 Logs Not Showing

### Symptom
Old logs like `"--- line.lc is ready ---"` instead of new detailed logs

### Diagnosis
```bash
grep "STARTUP" dist/index.js
# Should return multiple lines with console.log("[STARTUP]")
```

### Solutions

#### A. Code Not Compiled
```bash
cd ~/projects/rn/examples/basic
rm -rf dist/
npm run build
cp src/config.json dist/config.json
pm2 restart discord-bot
```

#### B. PM2 Running Old File
```bash
pm2 describe discord-bot
# Check "script path" - should be .../dist/index.js

pm2 delete discord-bot
pm2 start dist/index.js --name discord-bot
pm2 save
```

#### C. Git Changes Not Pulled
```bash
git pull origin main
npm run build
cp src/config.json dist/config.json
pm2 restart discord-bot
```

---

## 1️⃣1️⃣ Memory/Performance Issues

### Symptom
Bot crashes with out of memory errors

### Diagnosis
```bash
pm2 monit
# Check memory usage
```

### Solutions

#### A. Set Memory Limit
```bash
pm2 delete discord-bot
pm2 start dist/index.js --name discord-bot --max-memory-restart 500M
pm2 save
```

#### B. Memory Leak
Check logs for repeated errors or infinite loops

**Fix:** Restart bot and monitor:
```bash
pm2 restart discord-bot
pm2 logs discord-bot --lines 200
```

---

## 🔍 Diagnostic Commands

### Check Everything
```bash
# 1. Bot status
pm2 status

# 2. Recent logs
pm2 logs discord-bot --lines 100

# 3. Config exists
ls -la dist/config.json

# 4. Config content (hide sensitive data)
cat dist/config.json | grep -v token | grep -v mongo_uri

# 5. Compiled code has new logs
grep "STARTUP" dist/index.js | head -n 3

# 6. Node version
node --version  # Should be v22+

# 7. Dependencies installed
ls node_modules | grep mongodb

# 8. Git status
git status
git log --oneline -5
```

---

## 1️⃣2️⃣ Schedule / Alerts Issues

### Schedule tasks not running after restart
- Ensure MongoDB is connected.
- Scheduled tasks are stored in `scheduled_tasks` and loaded on startup.

### Alerts not received
- Ensure alerts are enabled: `$alerts status`
- Alerts are sent as DMs to the connected account.

---

## 🆘 Nuclear Option - Complete Reset

If nothing works, complete reset:

```bash
# 1. Backup config
cp ~/projects/rn/examples/basic/src/config.json ~/config.backup.json

# 2. Stop and delete bot
pm2 delete discord-bot

# 3. Remove project
cd ~/projects
rm -rf rn

# 4. Fresh clone
git clone https://github.com/lineuae/rn.git
cd rn/examples/basic

# 5. Restore config
cp ~/config.backup.json src/config.json

# 6. Install and build
npm install
npm run build
cp src/config.json dist/config.json

# 7. Start bot
pm2 start dist/index.js --name discord-bot
pm2 save

# 8. Verify
pm2 logs discord-bot --lines 50
```

---

## 📞 Getting Help

### Before Asking for Help

Collect this information:

```bash
# System info
uname -a
node --version
npm --version
pm2 --version

# Bot status
pm2 status
pm2 logs discord-bot --lines 100 > bot-logs.txt

# Git status
cd ~/projects/rn/examples/basic
git log --oneline -5
git status

# Build output
npm run build 2>&1 > build-output.txt
```

### Where to Get Help

1. **Check PROJECT_DOCUMENTATION.md** - Complete project reference
2. **Check DEPLOYMENT_GUIDE.md** - Deployment procedures
3. **GitHub Issues** - https://github.com/lineuae/rn/issues
4. **Discord.js Selfbot Docs** - https://github.com/aiko-chan-ai/discord.js-selfbot-v13

---

## 📝 Error Code Reference

| Error Code | Meaning | Solution |
|------------|---------|----------|
| TOKEN_INVALID | Discord token is invalid or expired | Update token in dist/config.json |
| ENOENT | File not found | Check file paths, copy config.json |
| ECONNREFUSED | MongoDB connection refused | Check mongo_uri, network access |
| MODULE_NOT_FOUND | NPM package missing | Run npm install |
| 50013 | Missing Permissions (Discord) | Check bot permissions in server |
| ETIMEDOUT | Connection timeout | Check network, firewall settings |

---

**📌 Keep this guide updated as new issues are discovered!**

**Last Updated:** February 27, 2026
