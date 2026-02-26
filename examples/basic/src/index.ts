import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, prepareStream, playStream, Utils } from "@dank074/discord-video-stream";
import { MongoClient, Db } from "mongodb";
import config from "./config.json" with {type: "json"};
import { 
    clearCommand, 
    clearallCommand, 
    helpCommand, 
    restartCommand, 
    configCommand, 
    scheduleCommand, 
    loadScheduledTasks,
    alertsCommand, 
    getAlertsEnabled, 
    sendAlert,
    healthCommand 
} from "./commands/index.js";

const streamer = new Streamer(new Client());
let db: Db;
let controller: AbortController;
let keepAliveInterval: NodeJS.Timeout | null = null;
let autoReconnectInterval: NodeJS.Timeout | null = null;
let currentSessionStart = 0;

// Connexion MongoDB
async function connectMongoDB() {
    const mongoUri = (config as any).mongo_uri;
    
    if (!mongoUri) {
        console.error("[ERROR] mongo_uri not defined in config.json");
        return;
    }
    
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db();
        console.log("[✓] MongoDB connected");
    } catch (error: any) {
        console.error("[✗] MongoDB connection failed:", error?.message);
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
    } catch (error) {
        console.error("[✗] Failed to save voice state:", error);
    }
}

// Supprimer l'état vocal
async function clearVoiceState() {
    if (!db) return;
    try {
        await db.collection("bot_state").deleteOne({ _id: "voice_state" } as any);
    } catch (error) {
        console.error("[✗] Failed to clear voice state:", error);
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
    } catch (error) {
        console.error("[✗] Failed to save autovoc state:", error);
    }
}

// Récupérer l'état autovoc
async function getAutoVocState() {
    if (!db) return null;
    try {
        const state = await db.collection("bot_state").findOne({ _id: "autovoc_state" } as any);
        return state;
    } catch (error) {
        console.error("[✗] Failed to get autovoc state:", error);
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
    } catch (error) {
        console.error("[✗] Failed to disable autovoc:", error);
    }
}

// ready event
streamer.client.on("ready", async () => {
    console.log(`[✓] Bot ready: ${streamer.client.user?.tag}`);
    
    currentSessionStart = Date.now();
    console.log(`[SESSION] Session started at ${currentSessionStart}`);
    console.log(`[SESSION] Current time: ${new Date().toISOString()}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await connectMongoDB();
    
    if (db) {
        // Charger les tâches programmées
        await loadScheduledTasks(db);
        
        // Connexion automatique au démarrage si AutoVoc activé
        const autoVocState = await getAutoVocState();
        if (autoVocState && autoVocState.enabled) {
            console.log("[AUTOVOC] Connecting to voice channel...");
            try {
                await streamer.joinVoice(autoVocState.guildId, autoVocState.channelId);
                console.log("[✓] AutoVoc connected");
            } catch (error) {
                console.error("[✗] AutoVoc connection failed:", error);
            }
        }
        
        // Démarrer la vérification périodique
        startAutoReconnect();
        console.log("[✓] AutoVoc monitoring started (check every 10 min)");
    }
    
    console.log("[SESSION] Bot initialization complete!");
});



// Vérification périodique toutes les 10 minutes
function startAutoReconnect() {
    if (autoReconnectInterval) clearInterval(autoReconnectInterval);
    
    autoReconnectInterval = setInterval(async () => {
        try {
            const autoVocState = await getAutoVocState();
            
            // Si AutoVoc n'est pas activé, ne rien faire
            if (!autoVocState || !autoVocState.enabled) {
                return;
            }
            
            // Vérifier si le bot est dans le bon canal vocal
            const currentVoiceState = streamer.client.user?.voice;
            const isInCorrectChannel = currentVoiceState?.channelId === autoVocState.channelId;
            
            // Si le bot n'est pas dans le bon canal, le reconnecter
            if (!isInCorrectChannel) {
                console.log("[AUTOVOC] Bot not in correct voice channel, reconnecting...");
                try {
                    await streamer.joinVoice(autoVocState.guildId, autoVocState.channelId);
                    console.log("[✓] AutoVoc reconnected");
                } catch (error) {
                    console.error("[✗] AutoVoc reconnection failed:", error);
                }
            }
        } catch (error) {
            console.error("[✗] AutoVoc check error:", error);
        }
    }, 600000); // 10 minutes
}

function stopAutoReconnect() {
    if (autoReconnectInterval) {
        clearInterval(autoReconnectInterval);
        autoReconnectInterval = null;
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
        streamer.leaveVoice();
        await clearVoiceState();
        console.log("[✓] Disconnected from voice");
        msg.edit("Deconnecté du vocal").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if(msg.content.startsWith("$stop-stream")) {
        controller?.abort();
        console.log("[✓] Stream stopped");
        msg.edit("Stream arreté").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$mute")) {
        (streamer as any).setSelfMute(true);
        msg.edit("Mute activé").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$unmute")) {
        (streamer as any).setSelfMute(false);
        msg.edit("Mute desactivé").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$deaf")) {
        (streamer as any).setSelfDeaf(true);
        msg.edit("Deaf activé").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$undeaf")) {
        (streamer as any).setSelfDeaf(false);
        msg.edit("Deaf désactivé").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$join")) {
        const args = msg.content.split(" ");
        
        if (args.length < 2) {
            msg.edit("Usage: $join <channel_id>").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        const channelId = args[1];
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
            msg.edit("Channel vocal introuvable").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        try {
            await streamer.joinVoice(targetGuildId, channelId);
            await saveVoiceState(targetGuildId, channelId);
            console.log(`[✓] Joined voice: ${targetChannel.guild.name}`);
            msg.edit(`Connecté a <#${channelId}>`).catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        } catch (error) {
            console.error("[✗] Join failed:", error);
            msg.edit("Erreur de connexion").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        }
    } else if (msg.content.startsWith("$find")) {
        const args = msg.content.split(" ");
        if (args.length < 2) {
            msg.edit("Usage: $find <user_id ou @mention>").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        let userId = args[1].replace(/[<@!>]/g, "");
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
            msg.edit("Utilisateur introuvable").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        const voiceChannel = foundMember.voice.channel;
        
        if (voiceChannel) {
            msg.edit(`${foundMember.user.tag} est en vocal dans <#${voiceChannel.id}>`).catch(() => {});
        } else {
            msg.edit(`${foundMember.user.tag} n'est pas en vocal`).catch(() => {});
        }
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (msg.content.startsWith("$autovoc")) {
        const args = msg.content.split(" ");
        
        if (args.length < 2) {
            await disableAutoVoc();
            console.log("[✓] AutoVoc disabled");
            msg.edit("AutoVoc désactivé").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        const channelId = args[1];
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
            msg.edit("Channel vocal introuvable").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        try {
            await saveAutoVocState(targetGuildId, channelId, true);
            await streamer.joinVoice(targetGuildId, channelId);
            console.log(`[✓] AutoVoc enabled: ${targetChannel.guild.name}`);
            msg.edit(`AutoVoc activé pour <#${channelId}>`).catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        } catch (error) {
            console.error("[✗] AutoVoc activation failed:", error);
            msg.edit("Erreur d'activation de l'autovoc").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        }
    } else if (msg.content.startsWith("$uptime")) {
        // Calculer l'uptime
        const uptimeMs = Date.now() - currentSessionStart;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        
        let uptimeStr = "";
        if (days > 0) uptimeStr += `${days}j `;
        if (hours > 0) uptimeStr += `${hours}h `;
        if (minutes > 0) uptimeStr += `${minutes}m `;
        uptimeStr += `${seconds}s`;
        
        // Informations sur la mémoire
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        
        // Statut MongoDB
        const mongoStatus = db ? "Connecté" : "Déconnecté";
        
        // Statut AutoVoc
        let autoVocStatus = "Désactivé";
        try {
            const autoVocState = await getAutoVocState();
            if (autoVocState && autoVocState.enabled) {
                const currentVoiceState = streamer.client.user?.voice;
                const isInChannel = currentVoiceState?.channelId === autoVocState.channelId;
                autoVocStatus = isInChannel ? "Actif & Connecté" : "Actif mais déconnecté";
            }
        } catch (e) {
            autoVocStatus = "Erreur de vérification";
        }
        
        // Statut vocal
        const voiceStatus = streamer.voiceConnection ? "Connecté" : "Déconnecté";
        
        // Construire le message
        const uptimeMessage = `**STATUT DU BOT**\n\n` +
            `**Compte:** \`${streamer.client.user?.tag}\`\n` +
            `**Uptime:** \`${uptimeStr}\`\n` +
            `**Mémoire:** \`${memUsedMB}MB / ${memTotalMB}MB\`\n` +
            `**MongoDB:** ${mongoStatus}\n` +
            `**Vocal:** ${voiceStatus}\n` +
            `**AutoVoc:** ${autoVocStatus}\n` +
            `**Plateforme:** \`${process.platform}\`\n` +
            `**Node.js:** \`${process.version}\``;
        
        msg.edit(uptimeMessage).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 15000);
    } else if (msg.content.startsWith("$help")) {
        await helpCommand(msg);
    } else if (msg.content.startsWith("$restart")) {
        await restartCommand(msg);
    } else if (msg.content.startsWith("$config")) {
        await configCommand(msg, config);
    } else if (msg.content.startsWith("$schedule")) {
        const args = msg.content.split(" ");
        await scheduleCommand(msg, args, db);
    } else if (msg.content.startsWith("$alerts")) {
        const args = msg.content.split(" ");
        await alertsCommand(msg, args, db);
    } else if (msg.content.startsWith("$health")) {
        await healthCommand(msg, currentSessionStart, db, streamer, getAutoVocState);
    } else if (msg.content.startsWith("$clearall")) {
        await clearallCommand(msg, currentSessionStart);
    } else if (msg.content.startsWith("$clear")) {
        const args = msg.content.split(" ");
        await clearCommand(msg, args, currentSessionStart);
    }
});

// login
streamer.client.login(config.token)
    .catch((error: any) => {
        console.error("[✗] Login failed:", error?.message);
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
