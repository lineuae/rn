import type { Streamer } from "@dank074/discord-video-stream";
import type { AutoVocState } from "./types.js";

export function startAutoReconnect(
    streamer: Streamer,
    getAutoVocState: () => Promise<AutoVocState | null>
): NodeJS.Timeout {
    return setInterval(async () => {
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

export function stopAutoReconnect(interval: NodeJS.Timeout | null): NodeJS.Timeout | null {
    if (interval) {
        clearInterval(interval);
        return null;
    }
    return interval;
}
