import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, Utils, prepareStream, playStream } from "@dank074/discord-video-stream";
import config from "./config.json" with {type: "json"};

const streamer = new Streamer(new Client());

// ready event
streamer.client.on("ready", () => {
    console.log(`--- ${streamer.client.user?.tag} is ready ---`);
});

let controller: AbortController;
let keepAliveInterval: NodeJS.Timeout | null = null;

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
        msg.edit("✅ Déconnecté du vocal").catch(() => console.log("Cannot edit message"));
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if(msg.content.startsWith("$stop-stream")) {
        controller?.abort();
        msg.edit("✅ Stream arrêté").catch(() => console.log("Cannot edit message"));
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$mute")) {
        streamer.setSelfMute(true);
        msg.edit("🔇 Mute activé").catch(() => console.log("Cannot edit message"));
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$unmute")) {
        streamer.setSelfMute(false);
        msg.edit("🔊 Mute désactivé").catch(() => console.log("Cannot edit message"));
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$deaf")) {
        streamer.setSelfDeaf(true);
        msg.edit("🔇 Deaf activé").catch(() => console.log("Cannot edit message"));
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$undeaf")) {
        streamer.setSelfDeaf(false);
        msg.edit("🔊 Deaf désactivé").catch(() => console.log("Cannot edit message"));
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$join")) {
        console.log("[JOIN] Command received");
        
        const args = msg.content.split(" ");
        console.log("[JOIN] Args:", args);
        
        if (args.length < 2) {
            console.log("[JOIN] No channel ID provided");
            msg.edit("❌ Usage: $join <channel_id>").catch(() => console.log("Cannot edit message"));
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
            msg.edit("❌ Channel vocal introuvable dans les serveurs accessibles").catch(() => console.log("Cannot edit message"));
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
            
            msg.edit(`✅ Connecté à <#${channelId}> dans ${targetChannel.guild.name}`).catch(() => console.log("Cannot edit message"));
            setTimeout(() => msg.delete().catch(() => {}), 30000);
        } catch (error) {
            console.error("[JOIN] Error:", error);
            msg.edit(`❌ Erreur lors de la connexion`).catch(() => console.log("Cannot edit message"));
            setTimeout(() => msg.delete().catch(() => {}), 30000);
        }
    } else if (msg.content.startsWith("$find")) {
        const args = msg.content.split(" ");
        if (args.length < 2) {
            msg.edit("❌ Usage: $find <user_id ou @mention>").catch(() => console.log("Cannot edit message"));
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
        
        if (!foundMember) {
            msg.edit("❌ Utilisateur introuvable dans les serveurs accessibles").catch(() => console.log("Cannot edit message"));
            setTimeout(() => msg.delete().catch(() => {}), 30000);
            return;
        }
        
        const voiceChannel = foundMember.voice.channel;
        
        if (voiceChannel) {
            msg.edit(`✅ ${foundMember.user.tag} est en vocal dans <#${voiceChannel.id}> (${foundGuild.name})`).catch(() => console.log("Cannot edit message"));
        } else {
            msg.edit(`❌ ${foundMember.user.tag} n'est pas en vocal`).catch(() => console.log("Cannot edit message"));
        }
        setTimeout(() => msg.delete().catch(() => {}), 30000);
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
