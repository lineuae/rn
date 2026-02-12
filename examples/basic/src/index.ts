import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, prepareStream, playStream, Utils } from "@dank074/discord-video-stream";
import { MongoClient, Db } from "mongodb";
import config from "./config.json" with {type: "json"};
import { clearCommand, clearallCommand } from "./commands/index.js";

console.log("[STARTUP] Bot script starting...");
console.log("[STARTUP] Config loaded:", {
    hasToken: !!config.token,
    hasMongoUri: !!(config as any).mongo_uri,
    mongoUri: (config as any).mongo_uri ? (config as any).mongo_uri.substring(0, 20) + "..." : "MISSING",
    acceptedAuthors: config.acceptedAuthors.length
});

const streamer = new Streamer(new Client());
let db: Db;
let controller: AbortController;
let keepAliveInterval: NodeJS.Timeout | null = null;
let autoReconnectInterval: NodeJS.Timeout | null = null;
let currentSessionStart = 0; // Sera défini quand le bot est ready

console.log("[STARTUP] Streamer and client created");

// Connexion MongoDB
async function connectMongoDB() {
    console.log("[MONGODB] Starting connection...");
    const mongoUri = (config as any).mongo_uri;
    console.log("[MONGODB] MongoDB URI:", mongoUri ? mongoUri.substring(0, 30) + "..." : "UNDEFINED");
    
    if (!mongoUri) {
        console.error("[MONGODB] ERROR: mongo_uri is not defined in config.json!");
        return;
    }
    
    try {
        console.log("[MONGODB] Creating MongoClient...");
        const client = new MongoClient(mongoUri);
        
        console.log("[MONGODB] Attempting to connect...");
        await client.connect();
        
        console.log("[MONGODB] Getting database...");
        db = client.db();
        
        console.log("[MONGODB] Connected successfully!");
        console.log("[MONGODB] Database name:", db.databaseName);
    } catch (error: any) {
        console.error("[MONGODB] Connection failed!");
        console.error("[MONGODB] Error type:", error?.constructor?.name || "Unknown");
        console.error("[MONGODB] Error message:", error?.message || "No message");
        console.error("[MONGODB] Full error:", error);
    }
}

// Sauvegarder l'état vocal
async function saveVoiceState(guildId: string, channelId: string) {
    if (!db) return;
    try {
        await db.collection("bot_state").updateOne(
            { _id: "voice_state" } as any,
            { $set: { guildId, channelId, timestamp: Date.now() } },
            { upsert: true }
        );
        console.log("[MONGODB] Voice state saved");
    } catch (error) {
        console.error("[MONGODB] Failed to save voice state:", error);
    }
}

// Supprimer l'état vocal
async function clearVoiceState() {
    if (!db) return;
    try {
        await db.collection("bot_state").deleteOne({ _id: "voice_state" } as any);
        console.log("[MONGODB] Voice state cleared");
    } catch (error) {
        console.error("[MONGODB] Failed to clear voice state:", error);
    }
}

// Sauvegarder l'état autovoc
async function saveAutoVocState(guildId: string, channelId: string, enabled: boolean) {
    if (!db) return;
    try {
        await db.collection("bot_state").updateOne(
            { _id: "autovoc_state" } as any,
            { $set: { guildId, channelId, enabled, timestamp: Date.now() } },
            { upsert: true }
        );
        console.log("[MONGODB] AutoVoc state saved:", { enabled, channelId });
    } catch (error) {
        console.error("[MONGODB] Failed to save autovoc state:", error);
    }
}

// Récupérer l'état autovoc
async function getAutoVocState() {
    if (!db) return null;
    try {
        const state = await db.collection("bot_state").findOne({ _id: "autovoc_state" } as any);
        return state;
    } catch (error) {
        console.error("[MONGODB] Failed to get autovoc state:", error);
        return null;
    }
}

// Désactiver l'autovoc
async function disableAutoVoc() {
    if (!db) return;
    try {
        await db.collection("bot_state").updateOne(
            { _id: "autovoc_state" } as any,
            { $set: { enabled: false, timestamp: Date.now() } },
            { upsert: true }
        );
        console.log("[MONGODB] AutoVoc disabled");
    } catch (error) {
        console.error("[MONGODB] Failed to disable autovoc:", error);
    }
}

// Note: La restauration automatique au démarrage a été retirée
// Utilisez $autovoc <channel_id> pour activer la reconnexion automatique

// ready event
streamer.client.on("ready", async () => {
    console.log("\n========================================");
    console.log(`[READY] Bot is ready: ${streamer.client.user?.tag}`);
    console.log("========================================\n");
    
    // Définir le timestamp de démarrage de cette session
    currentSessionStart = Date.now();
    console.log(`[SESSION] Session started at ${currentSessionStart}`);
    console.log(`[SESSION] Current time: ${new Date().toISOString()}`);
    
    // Attendre un peu avant de connecter MongoDB
    console.log("[SESSION] Waiting 2 seconds before MongoDB connection...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("[SESSION] Calling connectMongoDB()...");
    await connectMongoDB();
    
    console.log("[SESSION] Checking if MongoDB is connected...");
    console.log(`[SESSION] db is defined: ${!!db}`);
    
    // Attendre que MongoDB soit connecté
    if (db) {
        console.log("[SESSION] MongoDB connected successfully");
        
        // Démarrer le système d'auto-reconnexion (vérifie si autovoc est activé)
        console.log("[SESSION] Starting auto-reconnect monitoring...");
        startAutoReconnect();
    } else {
        console.error("[SESSION] MongoDB NOT connected");
    }
    
    console.log("\n[SESSION] Bot initialization complete!\n");
});

// Fonction pour maintenir la connexion vocale active
function startVoiceKeepAlive() {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    
    // Envoyer un signal speaking toutes les 60 secondes pour garder la connexion active
    keepAliveInterval = setInterval(() => {
        if (streamer.voiceConnection) {
            try {
                streamer.voiceConnection.setSpeaking(true);
                setTimeout(() => {
                    if (streamer.voiceConnection) {
                        streamer.voiceConnection.setSpeaking(false);
                    }
                }, 100);
            } catch (error) {
                console.log("[KEEPALIVE] Error sending speaking signal:", error);
            }
        }
    }, 60000);
    console.log("[KEEPALIVE] Voice keepalive started");
}

function stopVoiceKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log("[KEEPALIVE] Voice keepalive stopped");
    }
}

// Fonction pour démarrer l'auto-reconnexion
function startAutoReconnect() {
    if (autoReconnectInterval) clearInterval(autoReconnectInterval);
    
    // Vérifier la connexion toutes les 10 minutes
    autoReconnectInterval = setInterval(async () => {
        try {
            const autoVocState = await getAutoVocState();
            
            // Si l'autovoc est activé et que le bot n'est pas connecté
            if (autoVocState && autoVocState.enabled && !streamer.voiceConnection) {
                console.log("[AUTOVOC] Bot disconnected, attempting reconnection...");
                console.log("[AUTOVOC] Target channel:", autoVocState.channelId);
                
                try {
                    await streamer.joinVoice(autoVocState.guildId, autoVocState.channelId);
                    
                    // Activer deaf automatiquement lors de la reconnexion
                    streamer.setSelfDeaf(true);
                    console.log("[AUTOVOC] Self-deaf activated");
                    
                    startVoiceKeepAlive();
                    console.log("[AUTOVOC] Successfully reconnected to voice channel");
                } catch (error) {
                    console.error("[AUTOVOC] Failed to reconnect:", error);
                }
            }
        } catch (error) {
            console.error("[AUTOVOC] Error in auto-reconnect check:", error);
        }
    }, 600000); // Toutes les 10 minutes (600000 ms)
    
    console.log("[AUTOVOC] Auto-reconnect monitoring started");
}

function stopAutoReconnect() {
    if (autoReconnectInterval) {
        clearInterval(autoReconnectInterval);
        autoReconnectInterval = null;
        console.log("[AUTOVOC] Auto-reconnect monitoring stopped");
    }
}

// Fonction pour vérifier si un message est de la session actuelle
function isCurrentSession(msg: any): boolean {
    // Un message est de la session actuelle s'il a été créé après le démarrage du bot
    return msg.createdTimestamp >= currentSessionStart;
}

// message event
streamer.client.on("messageCreate", async (msg: any) => {
    if (msg.author.bot) return;

    if (!config.acceptedAuthors.includes(msg.author.id)) return;

    if (!msg.content) return;

    if (msg.content.startsWith("$play-live")) {
        const args = parseArgs(msg.content)
        if (!args) return;

        const channel = msg.author.voice?.channel;

        if(!channel) return;

        console.log(`Attempting to join voice channel ${msg.guild?.id}/${channel.id}`);
        await streamer.joinVoice(msg.guild?.id!, channel.id);

        if (channel instanceof StageChannel)
        {
            await streamer.client.user?.voice?.setSuppressed(false);
        }

        controller?.abort();
        controller = new AbortController();

        const { command, output } = prepareStream(args.url, {
            width: config.streamOpts.width,
            height: config.streamOpts.height,
            frameRate: config.streamOpts.fps,
            bitrateVideo: config.streamOpts.bitrateKbps,
            bitrateVideoMax: config.streamOpts.maxBitrateKbps,
            hardwareAcceleratedDecoding: config.streamOpts.hardware_acceleration,
            videoCodec: Utils.normalizeVideoCodec(config.streamOpts.videoCodec)
        }, controller.signal);
        command.on("error", (err: any) => {
            console.log("An error happened with ffmpeg");
            console.log(err);
        });
        await playStream(output, streamer, undefined, controller.signal)
            .catch(() => controller.abort());
    } else if (msg.content.startsWith("$play-cam")) {
        const args = parseArgs(msg.content);
        if (!args) return;

        const channel = msg.author.voice?.channel;

        if (!channel) return;

        console.log(`Attempting to join voice channel ${msg.guild?.id}/${channel.id}`);
        const vc = await streamer.joinVoice(msg.guild?.id!, channel.id);

        if (channel instanceof StageChannel)
        {
            await streamer.client.user?.voice?.setSuppressed(false);
        }

        controller?.abort();
        controller = new AbortController();

        const { command, output } = prepareStream(args.url, {
            width: config.streamOpts.width,
            height: config.streamOpts.height,
            frameRate: config.streamOpts.fps,
            bitrateVideo: config.streamOpts.bitrateKbps,
            bitrateVideoMax: config.streamOpts.maxBitrateKbps,
            hardwareAcceleratedDecoding: config.streamOpts.hardware_acceleration,
            videoCodec: Utils.normalizeVideoCodec(config.streamOpts.videoCodec)
        }, controller.signal)
        command.on("error", (err: any) => {
            console.log("An error happened with ffmpeg");
            console.log(err);
        });
        await playStream(output, streamer, undefined, controller.signal)
            .catch(() => controller.abort());
    } else if (msg.content.startsWith("$disconnect")) {
        controller?.abort();
        stopVoiceKeepAlive();
        streamer.leaveVoice();
        await clearVoiceState();
        console.log("[DISCONNECT] Déconnecté du vocal");
        msg.edit("Deconnecte du vocal").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if(msg.content.startsWith("$stop-stream")) {
        controller?.abort();
        console.log("[STOP-STREAM] Stream arrêté");
        msg.edit("Stream arrete").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$mute")) {
        streamer.setSelfMute(true);
        console.log("[MUTE] Mute activé");
        msg.edit("Mute active").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$unmute")) {
        streamer.setSelfMute(false);
        console.log("[UNMUTE] Mute désactivé");
        msg.edit("Mute desactive").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$deaf")) {
        streamer.setSelfDeaf(true);
        console.log("[DEAF] Deaf activé");
        msg.edit("Deaf active").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$undeaf")) {
        streamer.setSelfDeaf(false);
        console.log("[UNDEAF] Deaf désactivé");
        msg.edit("Deaf desactive").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$join")) {
        console.log("[JOIN] Command received");
        
        const args = msg.content.split(" ");
        console.log("[JOIN] Args:", args);
        
        if (args.length < 2) {
            console.log("[JOIN] No channel ID provided");
            msg.edit("Usage: $join <channel_id>").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        const channelId = args[1];
        console.log("[JOIN] Channel ID:", channelId);
        
        // Chercher le channel dans tous les serveurs accessibles
        let targetChannel = null;
        let targetGuildId = null;
        
        for (const [guildId, guild] of streamer.client.guilds.cache) {
            const channel = guild.channels.cache.get(channelId);
            if (channel && (channel.type === "GUILD_VOICE" || channel.type === "GUILD_STAGE_VOICE")) {
                targetChannel = channel;
                targetGuildId = guildId;
                break;
            }
        }
        
        if (!targetChannel || !targetGuildId) {
            console.log("[JOIN] Channel not found in any accessible guild");
            msg.edit("Channel vocal introuvable").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        console.log("[JOIN] Found channel in guild:", targetGuildId);
        
        try {
            console.log("[JOIN] Attempting to join voice...");
            await streamer.joinVoice(targetGuildId, channelId);
            console.log("[JOIN] Successfully joined voice");
            console.log("[JOIN] Voice connection exists:", !!streamer.voiceConnection);
            
            // Démarrer le keepalive pour maintenir la connexion
            startVoiceKeepAlive();
            
            // Sauvegarder l'état dans MongoDB
            await saveVoiceState(targetGuildId, channelId);
            
            console.log(`[JOIN] Connecté à ${targetChannel.guild.name}`);
            msg.edit(`Connecte a <#${channelId}>`).catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        } catch (error) {
            console.error("[JOIN] Error:", error);
            msg.edit("Erreur de connexion").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        }
    } else if (msg.content.startsWith("$find")) {
        const args = msg.content.split(" ");
        if (args.length < 2) {
            console.log("[FIND] No user ID provided");
            msg.edit("Usage: $find <user_id ou @mention>").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        let userId = args[1].replace(/[<@!>]/g, "");
        
        // Chercher l'utilisateur dans tous les serveurs
        let foundMember = null;
        let foundGuild = null;
        
        for (const [guildId, guild] of streamer.client.guilds.cache) {
            const member = guild.members.cache.get(userId);
            if (member) {
                foundMember = member;
                foundGuild = guild;
                break;
            }
        }
        
        if (!foundMember || !foundGuild) {
            console.log("[FIND] User not found");
            msg.edit("Utilisateur introuvable").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        const voiceChannel = foundMember.voice.channel;
        
        if (voiceChannel) {
            const channelName = voiceChannel.type === "DM" ? "DM" : (voiceChannel as any).name || voiceChannel.id;
            console.log(`[FIND] ${foundMember.user.tag} est en vocal dans ${channelName} (${foundGuild.name})`);
            msg.edit(`${foundMember.user.tag} est en vocal dans <#${voiceChannel.id}>`).catch(() => {});
        } else {
            console.log(`[FIND] ${foundMember.user.tag} n'est pas en vocal`);
            msg.edit(`${foundMember.user.tag} n'est pas en vocal`).catch(() => {});
        }
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$autovoc")) {
        console.log("[AUTOVOC] Command received");
        
        const args = msg.content.split(" ");
        console.log("[AUTOVOC] Args:", args);
        
        // Si pas d'argument, désactiver l'autovoc
        if (args.length < 2) {
            console.log("[AUTOVOC] No channel ID provided, disabling autovoc");
            await disableAutoVoc();
            msg.edit("AutoVoc desactive").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        const channelId = args[1];
        console.log("[AUTOVOC] Channel ID:", channelId);
        
        // Chercher le channel dans tous les serveurs accessibles
        let targetChannel = null;
        let targetGuildId = null;
        
        for (const [guildId, guild] of streamer.client.guilds.cache) {
            const channel = guild.channels.cache.get(channelId);
            if (channel && (channel.type === "GUILD_VOICE" || channel.type === "GUILD_STAGE_VOICE")) {
                targetChannel = channel;
                targetGuildId = guildId;
                break;
            }
        }
        
        if (!targetChannel || !targetGuildId) {
            console.log("[AUTOVOC] Channel not found in any accessible guild");
            msg.edit("Channel vocal introuvable").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        console.log("[AUTOVOC] Found channel in guild:", targetGuildId);
        
        try {
            // Sauvegarder l'état autovoc comme activé
            await saveAutoVocState(targetGuildId, channelId, true);
            
            // Rejoindre le canal immédiatement
            console.log("[AUTOVOC] Attempting to join voice...");
            await streamer.joinVoice(targetGuildId, channelId);
            console.log("[AUTOVOC] Successfully joined voice");
            
            // Activer deaf automatiquement
            streamer.setSelfDeaf(true);
            console.log("[AUTOVOC] Self-deaf activated");
            
            // Démarrer le keepalive
            startVoiceKeepAlive();
            
            console.log(`[AUTOVOC] AutoVoc activé pour <#${channelId}>`);
            msg.edit(`AutoVoc active pour <#${channelId}>`).catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        } catch (error) {
            console.error("[AUTOVOC] Error:", error);
            msg.edit("Erreur d'activation de l'autovoc").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        }
    } else if (msg.content.startsWith("$clear")) {
        const args = msg.content.split(" ");
        await clearCommand(msg, args, currentSessionStart);
    } else if (msg.content.startsWith("$clearall")) {
        await clearallCommand(msg, currentSessionStart);
    }
});

// login
console.log("[STARTUP] Attempting to login...");
console.log("[STARTUP] Token exists:", !!config.token);
streamer.client.login(config.token)
    .then(() => {
        console.log("[STARTUP] Login successful!");
    })
    .catch((error: any) => {
        console.error("[STARTUP] Login failed!");
        console.error("[STARTUP] Error:", error);
    });

function parseArgs(message: string): Args | undefined {
    const args = message.split(" ");
    if (args.length < 2) return;

    const url = args[1];

    return { url }
}

type Args = {
    url: string;
}
