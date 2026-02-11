import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, prepareStream, playStream, Utils } from "@dank074/discord-video-stream";
import { MongoClient, Db } from "mongodb";
import config from "./config.json" with {type: "json"};
import { clearCommand, clearallCommand } from "./commands/index.js";

const streamer = new Streamer(new Client());
let db: Db;
let controller: AbortController;
let keepAliveInterval: NodeJS.Timeout | null = null;
let currentSessionStart = Date.now();

// Connexion MongoDB
async function connectMongoDB() {
    try {
        const client = new MongoClient(config.mongo_uri);
        await client.connect();
        db = client.db();
        console.log("[MONGODB] Connected successfully");
    } catch (error) {
        console.error("[MONGODB] Connection failed:", error);
    }
}

// Sauvegarder l'état vocal
async function saveVoiceState(guildId: string, channelId: string) {
    if (!db) return;
    try {
        await db.collection("bot_state").updateOne(
            { _id: "voice_state" },
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
        await db.collection("bot_state").deleteOne({ _id: "voice_state" });
        console.log("[MONGODB] Voice state cleared");
    } catch (error) {
        console.error("[MONGODB] Failed to clear voice state:", error);
    }
}

// Restaurer l'état vocal au démarrage
async function restoreVoiceState() {
    if (!db) return;
    try {
        const state = await db.collection("bot_state").findOne({ _id: "voice_state" });
        if (state && state.guildId && state.channelId) {
            console.log("[MONGODB] Restoring voice state...");
            await streamer.joinVoice(state.guildId, state.channelId);
            startVoiceKeepAlive();
            console.log(`[MONGODB] Reconnected to voice channel ${state.channelId}`);
        }
    } catch (error) {
        console.error("[MONGODB] Failed to restore voice state:", error);
    }
}

// ready event
streamer.client.on("ready", async () => {
    console.log(`--- ${streamer.client.user?.tag} is ready ---`);
    await connectMongoDB();
    await restoreVoiceState();
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

// Fonction pour vérifier si un message est de la session actuelle
function isCurrentSession(msg: any): boolean {
    // Un message est de la session actuelle s'il a été créé après le démarrage du bot
    return msg.createdTimestamp >= currentSessionStart;
}

// message event
streamer.client.on("messageCreate", async (msg) => {
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
        command.on("error", (err) => {
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
        command.on("error", (err) => {
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
        if (isCurrentSession(msg)) {
            msg.edit("Déconnecté du vocal").catch(() => {});
        }
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if(msg.content.startsWith("$stop-stream")) {
        controller?.abort();
        console.log("[STOP-STREAM] Stream arrêté");
        if (isCurrentSession(msg)) {
            msg.edit("Stream arrêté").catch(() => {});
        }
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$mute")) {
        streamer.setSelfMute(true);
        console.log("[MUTE] Mute activé");
        if (isCurrentSession(msg)) {
            msg.edit("Mute activé").catch(() => {});
        }
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$unmute")) {
        streamer.setSelfMute(false);
        console.log("[UNMUTE] Mute désactivé");
        if (isCurrentSession(msg)) {
            msg.edit("Mute désactivé").catch(() => {});
        }
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$deaf")) {
        streamer.setSelfDeaf(true);
        console.log("[DEAF] Deaf activé");
        if (isCurrentSession(msg)) {
            msg.edit("Deaf activé").catch(() => {});
        }
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$undeaf")) {
        streamer.setSelfDeaf(false);
        console.log("[UNDEAF] Deaf désactivé");
        if (isCurrentSession(msg)) {
            msg.edit("Deaf désactivé").catch(() => {});
        }
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$join")) {
        console.log("[JOIN] Command received");
        
        const args = msg.content.split(" ");
        console.log("[JOIN] Args:", args);
        
        if (args.length < 2) {
            console.log("[JOIN] No channel ID provided");
            if (isCurrentSession(msg)) {
                msg.edit("Usage: $join <channel_id>").catch(() => {});
            }
            setTimeout(() => msg.delete().catch(() => {}), 30000);
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
            if (isCurrentSession(msg)) {
                msg.edit("Channel vocal introuvable").catch(() => {});
            }
            setTimeout(() => msg.delete().catch(() => {}), 30000);
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
            if (isCurrentSession(msg)) {
                msg.edit(`Connecté à <#${channelId}>`).catch(() => {});
            }
            setTimeout(() => msg.delete().catch(() => {}), 30000);
        } catch (error) {
            console.error("[JOIN] Error:", error);
            if (isCurrentSession(msg)) {
                msg.edit("Erreur de connexion").catch(() => {});
            }
            setTimeout(() => msg.delete().catch(() => {}), 30000);
        }
    } else if (msg.content.startsWith("$find")) {
        const args = msg.content.split(" ");
        if (args.length < 2) {
            console.log("[FIND] No user ID provided");
            if (isCurrentSession(msg)) {
                msg.edit("Usage: $find <user_id ou @mention>").catch(() => {});
            }
            setTimeout(() => msg.delete().catch(() => {}), 30000);
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
            if (isCurrentSession(msg)) {
                msg.edit("Utilisateur introuvable").catch(() => {});
            }
            setTimeout(() => msg.delete().catch(() => {}), 30000);
            return;
        }
        
        const voiceChannel = foundMember.voice.channel;
        
        if (voiceChannel) {
            const channelName = voiceChannel.type === "DM" ? "DM" : (voiceChannel as any).name || voiceChannel.id;
            console.log(`[FIND] ${foundMember.user.tag} est en vocal dans ${channelName} (${foundGuild.name})`);
            if (isCurrentSession(msg)) {
                msg.edit(`${foundMember.user.tag} est en vocal dans <#${voiceChannel.id}>`).catch(() => {});
            }
        } else {
            console.log(`[FIND] ${foundMember.user.tag} n'est pas en vocal`);
            if (isCurrentSession(msg)) {
                msg.edit(`${foundMember.user.tag} n'est pas en vocal`).catch(() => {});
            }
        }
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$clear")) {
        const args = msg.content.split(" ");
        await clearCommand(msg, args, currentSessionStart);
    } else if (msg.content.startsWith("$clearall")) {
        await clearallCommand(msg, currentSessionStart);
    }
});

// login
streamer.client.login(config.token);

function parseArgs(message: string): Args | undefined {
    const args = message.split(" ");
    if (args.length < 2) return;

    const url = args[1];

    return { url }
}

type Args = {
    url: string;
}
