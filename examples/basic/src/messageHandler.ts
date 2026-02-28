import { StageChannel, type Message } from "discord.js-selfbot-v13";
import { Streamer, prepareStream, playStream, Utils } from "@dank074/discord-video-stream";
import type { Db } from "mongodb";
import type { AppConfig, Args, AutoVocState } from "./types.js";
import {
    clearCommand,
    clearallCommand,
    helpCommand,
    restartCommand,
    configCommand,
    scheduleCommand,
    alertsCommand,
    healthCommand,
    gsCommand,
} from "./commands/index.js";
import {
    clearVoiceState,
    saveAutoVocState,
    saveVoiceState,
    disableAutoVoc,
} from "./mongo.js";

export function registerMessageHandler(
    streamer: Streamer,
    getDb: () => Db | undefined,
    config: AppConfig,
    getAutoVocState: () => Promise<AutoVocState | null>,
    getCurrentSessionStart: () => number,
): void {
    let controller: AbortController;

    function parseArgs(message: string): Args | undefined {
        const args = message.split(" ");
        if (args.length < 2) return;

        const url = args[1];

        return { url };
    }

    // message event
    streamer.client.on("messageCreate", async (msg: Message) => {
        const db = getDb();

        if (msg.author.bot) return;

        if (!config.acceptedAuthors.includes(msg.author.id)) return;

        if (!msg.content) return;

        if (msg.content.startsWith("$play-live")) {
            const args = parseArgs(msg.content);
            if (!args) return;

            const channel = msg.author.voice?.channel;

            if (!channel) return;

            console.log(`Attempting to join voice channel ${msg.guild?.id}/${channel.id}`);
            await streamer.joinVoice(msg.guild?.id!, channel.id);

            if (channel instanceof StageChannel) {
                await streamer.client.user?.voice?.setSuppressed(false);
            }

            controller?.abort();
            controller = new AbortController();

            const { command, output } = prepareStream(
                args.url,
                {
                    width: config.streamOpts.width,
                    height: config.streamOpts.height,
                    frameRate: config.streamOpts.fps,
                    bitrateVideo: config.streamOpts.bitrateKbps,
                    bitrateVideoMax: config.streamOpts.maxBitrateKbps,
                    hardwareAcceleratedDecoding: config.streamOpts.hardware_acceleration,
                    videoCodec: Utils.normalizeVideoCodec(config.streamOpts.videoCodec),
                },
                controller.signal,
            );
            command.on("error", (err: any) => {
                console.log("An error happened with ffmpeg");
                console.log(err);
            });
            await playStream(output, streamer, undefined, controller.signal).catch(() => controller.abort());
        } else if (msg.content.startsWith("$play-cam")) {
            const args = parseArgs(msg.content);
            if (!args) return;

            const channel = msg.author.voice?.channel;

            if (!channel) return;

            console.log(`Attempting to join voice channel ${msg.guild?.id}/${channel.id}`);
            const vc = await streamer.joinVoice(msg.guild?.id!, channel.id);

            if (channel instanceof StageChannel) {
                await streamer.client.user?.voice?.setSuppressed(false);
            }

            controller?.abort();
            controller = new AbortController();

            const { command, output } = prepareStream(
                args.url,
                {
                    width: config.streamOpts.width,
                    height: config.streamOpts.height,
                    frameRate: config.streamOpts.fps,
                    bitrateVideo: config.streamOpts.bitrateKbps,
                    bitrateVideoMax: config.streamOpts.maxBitrateKbps,
                    hardwareAcceleratedDecoding: config.streamOpts.hardware_acceleration,
                    videoCodec: Utils.normalizeVideoCodec(config.streamOpts.videoCodec),
                },
                controller.signal,
            );
            command.on("error", (err: any) => {
                console.log("An error happened with ffmpeg");
                console.log(err);
            });
            await playStream(output, streamer, undefined, controller.signal).catch(() => controller.abort());
        } else if (msg.content.startsWith("$disconnect")) {
            controller?.abort();
            streamer.leaveVoice();
            await clearVoiceState(db);
            console.log("[✓] Disconnected from voice");
            msg.edit("Deconnecté du vocal").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        } else if (msg.content.startsWith("$stop-stream")) {
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
            let targetChannel: any = null;
            let targetGuildId: string | null = null;

            for (const [guildId, guild] of streamer.client.guilds.cache) {
                const channel = guild.channels.cache.get(channelId as any) as any;
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
                await saveVoiceState(db, targetGuildId, channelId);
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

            const userId = args[1].replace(/[<@!>]/g, "");
            let foundMember: any = null;
            let foundGuild: any = null;

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
                await disableAutoVoc(db);
                console.log("[✓] AutoVoc disabled");
                msg.edit("AutoVoc désactivé").catch(() => {});
                setTimeout(() => msg.delete().catch(() => {}), 5000);
                return;
            }

            const channelId = args[1];
            let targetChannel: any = null;
            let targetGuildId: string | null = null;

            for (const [guildId, guild] of streamer.client.guilds.cache) {
                const channel = guild.channels.cache.get(channelId as any) as any;
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
                await saveAutoVocState(db, targetGuildId, channelId, true);
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
            const currentSessionStart = getCurrentSessionStart();

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
            await configCommand(msg, config as any);
        } else if (msg.content.startsWith("$schedule")) {
            const args = msg.content.split(" ");
            await scheduleCommand(msg as any, args, db as any);
        } else if (msg.content.startsWith("$alerts")) {
            const args = msg.content.split(" ");
            await alertsCommand(msg as any, args, db as any);
        } else if (msg.content.startsWith("$health")) {
            const currentSessionStart = getCurrentSessionStart();
            await healthCommand(msg as any, currentSessionStart, db as any, streamer as any, () => getAutoVocState());
        } else if (msg.content.startsWith("$gs")) {
            const args = msg.content.split(" ");
            await gsCommand(msg as any, args, streamer.client as any);
        } else if (msg.content.startsWith("$clearall")) {
            const currentSessionStart = getCurrentSessionStart();
            await clearallCommand(msg as any, currentSessionStart);
        } else if (msg.content.startsWith("$clear")) {
            const args = msg.content.split(" ");
            const currentSessionStart = getCurrentSessionStart();
            await clearCommand(msg as any, args, currentSessionStart);
        }
    });
}
