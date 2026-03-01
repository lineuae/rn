# Discord Selfbot (Streaming + AutoVoc + Commands)

Fork: [Discord-video-experiment](https://github.com/mrjvs/Discord-video-experiment)

> [!CAUTION]
> Using automation on a Discord user account can result in sanctions/bans. Use at your own risk.

This repository contains:

- The upstream streaming library code
- A runnable selfbot application under `examples/basic/` (this is the part used in production)

## Features (examples/basic)

- Video & audio streaming in voice channels (Go Live or webcam)
- Voice controls (join/mute/deaf/find)
- MongoDB persistence for bot state
- AutoVoc: auto-join on startup + periodic (10 min) correct-channel check
- Ops commands: help/uptime/health/config/restart
- Scheduling: schedule commands with persistence across restarts
- Alerts: enable/disable DM notifications to the connected account
- GS: interactive mass DM with confirmation, delay, failed IDs report, hard limit (50 recipients) and 30-minute global cooldown

## Requirements

- Node.js (ESM project)
- FFmpeg available on the machine (VPS or local)
- A Discord user token (selfbot)
- Optional but recommended: MongoDB Atlas (used for AutoVoc/schedule/alerts)

## Setup (Local)

From the repo root:

```bash
cd examples/basic
npm install
```

### Configure

Copy the example config and edit it:

```bash
cd examples/basic/src
cp config.example.json config.json
```

Fields:

- `token`: Discord user token
- `acceptedAuthors`: list of user IDs allowed to use commands
- `mongo_uri`: MongoDB connection string
- `streamOpts`: default streaming quality

> [!IMPORTANT]
> `examples/basic/src/config.json` is ignored by git and must never be committed.

### Build

```bash
cd examples/basic
npm run build
```

> [!IMPORTANT]
> The build script automatically copies `src/config.json` to `dist/config.json` via a postbuild step.
> Ensure that `examples/basic/src/config.json` exists **before** running `npm run build`.

## Run

Start the compiled bot (production-style):

```bash
node dist/index.js
```

## Commands

Use `$help` to see the up-to-date list.

Core commands:

- `$play-live <url>`
- `$play-cam <url>`
- `$stop-stream`
- `$disconnect`
- `$join <channel_id>`
- `$mute` / `$unmute`
- `$deaf` / `$undeaf`
- `$find <user_id ou @mention>`

AutoVoc:

- `$autovoc <channel_id>`
- `$autovoc off`

Ops:

- `$uptime`
- `$health`
- `$config`
- `$restart`

Scheduling:

- `$schedule <time> <command>` (example: `$schedule 10m $disconnect`)
- `$schedule list`
- `$schedule clear`

Alerts:

- `$alerts on|off|status`

GS (mass DM):

- `$gs start`
- `$gs add <@ID ...>`
- `$gs msg <texte>`
- `$gs delay <ms>`
- `$gs send`
- `$gs confirm`
- `$gs stop`

## Deployment (VPS + PM2)

See:

- `DEPLOYMENT_GUIDE.md`
- `TROUBLESHOOTING.md`

## Performance

See `PERFORMANCE.md`.
