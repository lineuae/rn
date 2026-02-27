# 📋 PROJECT DOCUMENTATION - Discord Selfbot Video Stream

> **⚠️ IMPORTANT FOR AI ASSISTANTS:** This document contains complete project information for seamless handoff between AI assistants.

## 🎯 Project Overview

**Project Name:** Discord Selfbot with Video Streaming and Voice Commands  
**Primary Technology:** `discord.js-selfbot-v13` + `@dank074/discord-video-stream`  
**Language:** TypeScript → JavaScript (ES Modules)  
**Production Environment:** VPS Contabo (Ubuntu/Debian)  
**Process Manager:** PM2  
**Database:** MongoDB Atlas (Cloud)  
**GitHub Repository:** `https://github.com/lineuae/rn`  
**Main Branch:** `main`

---

## 📁 Project Structure

```
Discord-video-stream/
├── src/                          # Library source code
│   └── client/
│       └── Streamer.ts          # Main streaming class (MODIFIED: setSelfMute, setSelfDeaf)
├── examples/basic/              # Selfbot application (MAIN CODE)
│   ├── src/
│   │   ├── index.ts            # Main entry point
│   │   ├── config.json         # Configuration (token, mongo_uri, etc.)
│   │   └── commands/
│   │       ├── index.ts        # Command exports
│   │       ├── clear.ts        # $clear command
│   │       ├── clearall.ts     # $clearall command
│   │       ├── help.ts         # $help command
│   │       ├── restart.ts      # $restart command
│   │       ├── config.ts       # $config command
│   │       ├── schedule.ts     # $schedule command (+ persistent tasks)
│   │       ├── alerts.ts       # $alerts command (+ DM notifications)
│   │       ├── health.ts       # $health command
│   │       └── gs.ts           # $gs command (mass DM with confirmation)
│   ├── dist/                   # Compiled code (USED IN PRODUCTION)
│   │   ├── index.js
│   │   ├── config.json         # ⚠️ MUST BE COPIED MANUALLY
│   │   └── commands/
│   ├── package.json            # Dependencies (mongodb added)
│   └── tsconfig.json           # TypeScript configuration
└── package.json                # Library dependencies
```

---

## ⚙️ Configuration Files

### **`examples/basic/src/config.json`** (and `dist/config.json`)

```json
{
    "token": "DISCORD_SELFBOT_TOKEN",
    "acceptedAuthors": ["USER_ID"],
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

### ⚠️ CRITICAL: Config File Management

**TypeScript does NOT copy `.json` files during compilation!**

After every build, you MUST:
```bash
cp src/config.json dist/config.json
```

The bot reads from `dist/config.json` in production.

---

## 🚀 Implemented Features

### 1. Video Streaming Commands
- `$play-live <url>` - Stream live video
- `$play-cam <url>` - Stream from camera
- `$stop-stream` - Stop current stream
- `$disconnect` - Disconnect from voice and clear MongoDB state

### 2. Voice Commands
- `$join <channel_id>` - Join voice channel (works from any server or DM)
- `$mute` - Mute self
- `$unmute` - Unmute self
- `$deaf` - Deafen self
- `$undeaf` - Undeafen self
- `$find <user_id or @mention>` - Find user in voice

### 2.1. Info / Ops Commands
- `$help` - Show all commands (auto-delete after 30 seconds)
- `$uptime` - Bot status summary (account, uptime, voice, AutoVoc, Mongo)
- `$health` - Detailed VPS/system health summary
- `$config` - Show non-sensitive configuration summary
- `$restart` - Exits the process (PM2 restarts the bot)

### 2.2. Scheduling
- `$schedule <time> <command>` - Schedule a command (persisted in MongoDB)
- `$schedule list` - List scheduled tasks
- `$schedule clear` - Cancel all scheduled tasks

### 2.3. Alerts
- `$alerts on|off|status` - Enable/disable alert DMs to the connected account

### 2.4. Mass DM (GS)
- `$gs` - Interactive mass DM session with confirmation step and delay control

### 3. Message Management Commands
- `$clear <number>` - Delete X user messages in channel (1-100)
- `$clearall` - Delete ALL user messages in channel

**Features:**
- Work in **DM** and **server** channels
- Visual feedback with `msg.edit()` + auto-delete after 5 seconds
- Robust error handling with `.catch(() => {})`
- Detailed logging for debugging

### 4. MongoDB Persistence System

**Collections:**
- `bot_state` - Stores bot state/config documents
- `scheduled_tasks` - Stores scheduled commands for `$schedule`

**Document structure:**
```javascript
{
    _id: "voice_state",
    guildId: "123456789",
    channelId: "987654321",
    timestamp: 1707624000000
}
```

**Additional documents in `bot_state`:**
```javascript
{ _id: "autovoc_state", guildId, channelId, enabled, timestamp }
{ _id: "alerts_config", enabled, timestamp }
```

**Features:**
- Save voice state on `$join`
- Clear voice state on `$disconnect`
- AutoVoc state persistence (enabled + target channel)
- Scheduled tasks persistence (so they survive restarts)

### 5. AutoVoc (Robust)

**Goal:** If AutoVoc is enabled, ensure the selfbot stays connected to the configured voice channel.

**Behavior:**
- On startup, if AutoVoc is enabled in MongoDB, the bot joins the configured channel.
- Every 10 minutes, a periodic check verifies the bot is in the correct channel.
- The check uses `streamer.client.user?.voice?.channelId` compared to the configured `channelId`.

**Important:** The bot should join without forcing self-deaf or self-mute.

### 6. Detailed Startup Logs

All processes are logged for easy debugging:

```
[STARTUP] Bot script starting...
[STARTUP] Config loaded: {...}
[STARTUP] Attempting to login...
[STARTUP] Login successful!
[READY] Bot is ready: line.lc
[SESSION] Session started at 1707624000000
[MONGODB] Starting connection...
[MONGODB] Connected successfully!
[MONGODB] Database name: test
[SESSION] Bot initialization complete!
```

---

## 🔧 Technical Architecture

### Key Imports

```typescript
import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, prepareStream, playStream, Utils } from "@dank074/discord-video-stream";
import { MongoClient, Db } from "mongodb";
import config from "./config.json" with {type: "json"};
import { /* ...commands... */ } from "./commands/index.js";
```

### ⚠️ Critical Points

1. **JSON Import:** Uses `with {type: "json"}` (ES Module syntax)
2. **Command Imports:** Require `.js` extension (ES Module requirement)
3. **MongoDB Casts:** All use `as any` to avoid TypeScript errors
4. **Config Access:** Use `(config as any).mongo_uri` for type safety
5. **Streamer typings:** In the app, `setSelfMute` and `setSelfDeaf` are called through `(streamer as any)` to satisfy TypeScript.

### Session Management

```typescript
let currentSessionStart = 0;

streamer.client.on("ready", async () => {
    currentSessionStart = Date.now();
});

function isCurrentSession(msg: any): boolean {
    return msg.createdTimestamp >= currentSessionStart;
}
```

**Purpose:** Prevent bot from editing messages from previous sessions after restart.

### Multi-Server Search

Commands `$join` and `$find` search across **all accessible servers**:

```typescript
for (const [guildId, guild] of streamer.client.guilds.cache) {
    const channel = guild.channels.cache.get(channelId);
    if (channel && (channel.type === "GUILD_VOICE" || channel.type === "GUILD_STAGE_VOICE")) {
        targetChannel = channel;
        targetGuildId = guildId;
        break;
    }
}
```

Allows commands to work from **any server or DM**.

---

## 🐛 Common Issues & Solutions

### Issue 1: TypeScript Compilation Errors

**Problem:** `config.mongo_uri` doesn't exist in type, `error` parameters not typed, MongoDB `_id` type mismatch

**Solution:**
```typescript
const mongoUri = (config as any).mongo_uri;
catch (error: any) { ... }
{ _id: "voice_state" } as any
```

### Issue 2: Compiled File Not Updated

**Problem:** VPS shows old code after git pull

**Solution:**
```bash
git stash                    # If local changes exist
git pull origin main
npm install
rm -rf dist/                 # IMPORTANT: Delete old build
npm run build
cp src/config.json dist/config.json  # CRITICAL
pm2 restart discord-bot
```

### Issue 3: Config Not Found After Build

**Problem:** TypeScript doesn't copy `.json` files to `dist/`

**Solution:** Always copy manually:
```bash
cp src/config.json dist/config.json
```

### Issue 4: Commands Don't Work in DM

**Problem:** Strict TypeScript types for `msg.channel.messages`

**Solution:**
```typescript
const messages = await (msg.channel as any).messages.fetch({ limit: 100 });
await (message as any).delete();
```

### Issue 5: Bot Auto-Disconnects from Voice

**Problem:** Bot is not in the configured AutoVoc channel.

**Solution:** AutoVoc periodic check every 10 minutes verifies the correct channel and reconnects when needed.

**Note:** A voice keepalive/speaking simulation was removed.

---

## 🖥️ VPS Deployment

### Server Information

- **Host:** `vmi3077908.contaboserver.net`
- **Main User:** `discord-bot`
- **Admin User:** `root`
- **Project Path:** `/home/discord-bot/projects/rn/examples/basic`
- **Executed File:** `/home/discord-bot/projects/rn/examples/basic/dist/index.js`

### PM2 Configuration

```bash
# Start bot
pm2 start dist/index.js --name discord-bot

# Useful commands
pm2 status              # View status
pm2 logs discord-bot    # View logs
pm2 restart discord-bot # Restart
pm2 stop discord-bot    # Stop
pm2 delete discord-bot  # Remove from PM2
```

### Update Process

```bash
# 1. Connect via SSH
ssh discord-bot@vmi3077908.contaboserver.net

# 2. Navigate to project
cd ~/projects/rn/examples/basic

# 3. Pull changes
git pull origin main

# 4. Install dependencies (if needed)
npm install

# 5. Delete old build
rm -rf dist/

# 6. Recompile
npm run build

# 7. Copy config.json (CRITICAL!)
cp src/config.json dist/config.json

# 8. Restart bot
pm2 restart discord-bot

# 9. Check logs
pm2 logs discord-bot --lines 50
```

### Verify Compilation Success

```bash
# Check if new logs are in compiled file
grep "STARTUP" dist/index.js | head -n 3

# Should output lines containing console.log("[STARTUP]")
```

---

## 📦 Dependencies

### `examples/basic/package.json`

```json
{
  "name": "@dank074/discord-video-stream-example",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@dank074/discord-video-stream": "file:../..",
    "discord.js-selfbot-v13": "^3.3.0",
    "mongodb": "^6.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.4.0",
    "typescript": "^5.5.4"
  }
}
```

**Key Addition:** `"mongodb": "^6.3.0"`

---

## 🔑 Critical Points to Remember

### 1. Two Config Files Required
- `src/config.json` - For development
- `dist/config.json` - For production (MUST be copied manually)

### 2. TypeScript Compilation
- Always delete `dist/` before rebuilding: `rm -rf dist/`
- Verify new logs are present: `grep "STARTUP" dist/index.js`
- Copy config after build: `cp src/config.json dist/config.json`

### 3. MongoDB
- URI stored in `config.json`: `mongo_uri`
- Collection: `bot_state`
- Document: `{ _id: "voice_state", guildId, channelId, timestamp }`
- All MongoDB filters use `as any` for type safety

### 4. Error Handling
- All `msg.edit()` have `.catch(() => {})`
- All `msg.delete()` have `.catch(() => {})`
- Auto-delete after 5 seconds: `setTimeout(() => msg.delete().catch(() => {}), 5000)`

### 5. TypeScript Types
- Use `(config as any).mongo_uri` to avoid type errors
- Use `(msg.channel as any)` for message operations
- Use `{ _id: "voice_state" } as any` for MongoDB
- Type all `error` and `err` parameters with `: any`

---

## 🎯 Current Project Status

### ✅ Functional
- ✅ Bot starts correctly with detailed logs
- ✅ MongoDB connection successful
- ✅ All voice commands working
- ✅ `$clear` and `$clearall` work in DM and server
- ✅ Voice state persistence with MongoDB
- ✅ AutoVoc: connect on startup + 10 minute correct-channel check
- ✅ Multi-server search for `$join` and `$find`
- ✅ VPS deployment with PM2
- ✅ New command system under `examples/basic/src/commands`
- ✅ Mass DM command `$gs` with confirmation + delay + failed IDs in report

### ⚠️ Points of Attention

1. **Config.json must be copied manually** after each build
2. **Selfbot risk:** Automations can lead to account sanctions (use at your own risk)
3. **Scheduling:** `$schedule` persists tasks in MongoDB (`scheduled_tasks`), and they are loaded on startup.
4. **Rate limits:** `$gs` applies delays but mass DM can still be rate-limited.

### 🔮 Possible Improvements

1. Automate config.json copy in build script
2. Add permission system for commands
3. Implement persistent logging system in MongoDB
4. Add playlist management commands for streaming
5. Create web dashboard for bot monitoring

---

## 📞 Connection Information

### SSH Access

```bash
# As discord-bot user
ssh discord-bot@vmi3077908.contaboserver.net

# As root user
ssh root@vmi3077908.contaboserver.net
```

### Reset discord-bot Password

```bash
# As root
passwd discord-bot
```

### Access discord-bot from root

```bash
su - discord-bot
```

---

## 🎓 Quick Reference Commands

### Local Development (Windows)

```powershell
cd c:\Users\linel\Discord-video-stream\examples\basic
npm install
npm run build
```

### Git Operations

```powershell
git add .
git commit -m "message"
git push origin main
```

### VPS Update

```bash
cd ~/projects/rn/examples/basic
git pull origin main
npm install
rm -rf dist/
npm run build
cp src/config.json dist/config.json
pm2 restart discord-bot
pm2 logs discord-bot
```

### PM2 Management

```bash
pm2 status
pm2 logs discord-bot
pm2 logs discord-bot --lines 100
pm2 restart discord-bot
pm2 stop discord-bot
pm2 start dist/index.js --name discord-bot
pm2 delete discord-bot
```

---

## 🔍 Debugging Checklist

When bot doesn't start or behaves incorrectly:

1. **Check logs:** `pm2 logs discord-bot --lines 100`
2. **Verify config exists:** `cat dist/config.json`
3. **Check MongoDB URI:** Look for `hasMongoUri: true` in startup logs
4. **Verify compilation:** `grep "STARTUP" dist/index.js`
5. **Check token validity:** Look for `TOKEN_INVALID` error
6. **Verify dependencies:** `npm install` in `examples/basic/`
7. **Clean rebuild:** `rm -rf dist/ && npm run build && cp src/config.json dist/config.json`

---

## 📝 Modified Files History

### Files Modified from Original Library

1. **`src/client/Streamer.ts`**
   - Added `setSelfMute(mute: boolean)` method
   - Added `setSelfDeaf(deaf: boolean)` method
   - Modified `signalVideo()` to accept `self_mute` and `self_deaf` parameters

### Files Created

1. **`examples/basic/src/commands/index.ts`** - Command exports
2. **`examples/basic/src/commands/clear.ts`** - Clear command implementation
3. **`examples/basic/src/commands/clearall.ts`** - Clear all command implementation

### Files Modified in examples/basic

1. **`examples/basic/src/index.ts`** - Main bot logic with all commands
2. **`examples/basic/package.json`** - Added mongodb dependency
3. **`examples/basic/src/config.json`** - Added mongo_uri field

---

## 🆘 Emergency Recovery

If bot is completely broken:

```bash
# 1. Connect as root
ssh root@vmi3077908.contaboserver.net

# 2. Switch to discord-bot user
su - discord-bot

# 3. Navigate to project
cd ~/projects/rn/examples/basic

# 4. Hard reset to last working commit
git fetch origin
git reset --hard origin/main

# 5. Clean install
rm -rf node_modules dist
npm install
npm run build
cp src/config.json dist/config.json

# 6. Restart
pm2 restart discord-bot
pm2 logs discord-bot
```

---

**📌 This document contains EVERYTHING an AI assistant needs to take over this project. Keep it updated!**

**Last Updated:** February 27, 2026  
**Status:** Fully Functional ✅
