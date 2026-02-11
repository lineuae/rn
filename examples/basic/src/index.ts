import { Client, StageChannel } from "discord.js-selfbot-v13";
import { Streamer, Utils, prepareStream, playStream } from "@dank074/discord-video-stream";
import config from "./config.json" with {type: "json"};

const streamer = new Streamer(new Client());

// ready event
streamer.client.on("ready", () => {
    console.log(`--- ${streamer.client.user?.tag} is ready ---`);
});

let controller: AbortController;

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

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        await streamer.joinVoice(msg.guildId!, channel.id);

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

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        const vc = await streamer.joinVoice(msg.guildId!, channel.id);

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
        streamer.leaveVoice();
        await msg.edit("✅ Déconnecté du vocal");
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if(msg.content.startsWith("$stop-stream")) {
        controller?.abort();
        await msg.edit("✅ Stream arrêté");
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$mute")) {
        console.log("Executing mute command");
        console.log("Voice connection exists:", !!streamer.voiceConnection);
        streamer.setSelfMute(true);
        await msg.edit("🔇 Mute activé");
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$unmute")) {
        console.log("Executing unmute command");
        console.log("Voice connection exists:", !!streamer.voiceConnection);
        streamer.setSelfMute(false);
        await msg.edit("🔊 Mute désactivé");
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$deaf")) {
        console.log("Executing deaf command");
        console.log("Voice connection exists:", !!streamer.voiceConnection);
        streamer.setSelfDeaf(true);
        await msg.edit("🔇 Deaf activé");
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$undeaf")) {
        console.log("Executing undeaf command");
        console.log("Voice connection exists:", !!streamer.voiceConnection);
        streamer.setSelfDeaf(false);
        await msg.edit("🔊 Deaf désactivé");
        setTimeout(() => msg.delete().catch(() => {}), 30000);
    } else if (msg.content.startsWith("$join")) {
        const channel = msg.author.voice?.channel;
        if (!channel) {
            await msg.edit("❌ Vous devez être dans un salon vocal");
            setTimeout(() => msg.delete().catch(() => {}), 30000);
            return;
        }
        await streamer.joinVoice(msg.guildId!, channel.id);
        await msg.edit(`✅ Connecté à <#${channel.id}>`);
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
