import { Client } from "discord.js-selfbot-v13";
import { Streamer } from "@dank074/discord-video-stream";
import type { Db } from "mongodb";
import rawConfig from "./config.json" with { type: "json" };
import type { AppConfig, AutoVocState } from "./types.js";
import { loadScheduledTasks } from "./commands/index.js";
import { connectMongoDB, getAutoVocState as getAutoVocStateFromDb } from "./mongo.js";
import { startAutoReconnect } from "./autovoc.js";
import { registerMessageHandler } from "./messageHandler.js";

const config = rawConfig as AppConfig;

function validateConfig(): void {
    const hasToken = typeof config.token === "string" && config.token.length > 0;
    const acceptedAuthors = config.acceptedAuthors;
    const hasAcceptedAuthors = Array.isArray(acceptedAuthors) && acceptedAuthors.length > 0;
    const hasMongoUri = typeof config.mongo_uri === "string" && config.mongo_uri.length > 0;

    console.log("[STARTUP] Validating configuration...");
    console.log("[STARTUP] hasToken:", hasToken);
    console.log("[STARTUP] acceptedAuthorsCount:", Array.isArray(acceptedAuthors) ? acceptedAuthors.length : 0);
    console.log("[STARTUP] hasMongoUri:", hasMongoUri);

    if (!hasToken) {
        console.error("[CONFIG] Missing or empty token in config.json");
        process.exit(1);
    }

    if (!hasAcceptedAuthors) {
        console.error("[CONFIG] acceptedAuthors must be a non-empty array in config.json");
        process.exit(1);
    }
}

validateConfig();

const streamer = new Streamer(new Client());
let db: Db | undefined;
let autoReconnectInterval: NodeJS.Timeout | null = null;
let currentSessionStart = 0;

registerMessageHandler(
    streamer,
    () => db,
    config,
    () => getAutoVocStateFromDb(db),
    () => currentSessionStart,
);

// ready event
streamer.client.on("ready", async () => {
    console.log(`[✓] Bot ready: ${streamer.client.user?.tag}`);
    
    currentSessionStart = Date.now();
    console.log(`[SESSION] Session started at ${currentSessionStart}`);
    console.log(`[SESSION] Current time: ${new Date().toISOString()}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    const connectedDb = await connectMongoDB(config.mongo_uri);
    if (connectedDb) {
        db = connectedDb;
        // Charger les tâches programmées
        await loadScheduledTasks(db);
        
        // Connexion automatique au démarrage si AutoVoc activé
        const autoVocState = await getAutoVocStateFromDb(db);
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
        autoReconnectInterval = startAutoReconnect(streamer, () => getAutoVocStateFromDb(db));
        console.log("[✓] AutoVoc monitoring started (check every 10 min)");
    }
    
    console.log("[SESSION] Bot initialization complete!");
});

// login
streamer.client.login(config.token)
    .catch((error: any) => {
        console.error("[✗] Login failed:", error?.message);
    });
