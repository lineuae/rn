import { MongoClient, type Db } from "mongodb";
import type { AutoVocState } from "./types.js";

export async function connectMongoDB(mongoUri: string | undefined): Promise<Db | null> {
    if (!mongoUri) {
        console.error("[ERROR] mongo_uri not defined in config.json");
        return null;
    }

    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        const db = client.db();
        console.log("[✓] MongoDB connected");
        return db;
    } catch (error: any) {
        console.error("[✗] MongoDB connection failed:", error?.message);
        return null;
    }
}

export async function saveVoiceState(db: Db | undefined, guildId: string, channelId: string) {
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

export async function clearVoiceState(db: Db | undefined) {
    if (!db) return;
    try {
        await db.collection("bot_state").deleteOne({ _id: "voice_state" } as any);
    } catch (error) {
        console.error("[✗] Failed to clear voice state:", error);
    }
}

export async function saveAutoVocState(db: Db | undefined, guildId: string, channelId: string, enabled: boolean) {
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

export async function getAutoVocState(db: Db | undefined): Promise<AutoVocState | null> {
    if (!db) return null;
    try {
        const state = await db
            .collection("bot_state")
            .findOne<AutoVocState>({ _id: "autovoc_state" } as any);
        return state ?? null;
    } catch (error) {
        console.error("[✗] Failed to get autovoc state:", error);
        return null;
    }
}

export async function disableAutoVoc(db: Db | undefined) {
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
