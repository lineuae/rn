import type { Message } from "discord.js-selfbot-v13";
import type { Db } from "mongodb";

export async function alertsCommand(msg: Message, args: string[], db: Db | null) {
    if (args.length < 2) {
        msg.edit("Usage: `$alerts on` ou `$alerts off` ou `$alerts status`").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    const subCommand = args[1].toLowerCase();

    if (subCommand === "status") {
        await showAlertsStatus(msg, db);
        return;
    }

    if (subCommand !== "on" && subCommand !== "off") {
        msg.edit("❌ Commande invalide. Utilisez: `on`, `off` ou `status`").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    try {
        const enabled = subCommand === "on";

        if (!db) {
            msg.edit("❌ Base de données non connectée").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }

        await db.collection("bot_state").updateOne(
            { _id: "alerts_config" } as any,
            { $set: { enabled, timestamp: Date.now() } },
            { upsert: true }
        );

        const statusEmoji = enabled ? "✅" : "❌";
        const statusText = enabled ? "activées" : "désactivées";
        
        msg.edit(`${statusEmoji} Alertes ${statusText}`).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);

        console.log(`[ALERTS] Alerts ${statusText}`);

    } catch (error) {
        console.error("[ALERTS] Error:", error);
        msg.edit("❌ Erreur lors de la configuration des alertes").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}

async function showAlertsStatus(msg: Message, db: Db | null) {
    try {
        if (!db) {
            msg.edit("❌ Base de données non connectée").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }

        const alertsConfig = await db.collection("bot_state").findOne({ _id: "alerts_config" } as any);
        const enabled = alertsConfig?.enabled || false;

        const statusMessage = `**🚨 Statut des Alertes**\n\n` +
            `État: ${enabled ? '✅ Activées' : '❌ Désactivées'}\n\n` +
            `**Types d'alertes:**\n` +
            `• Déconnexion vocale\n` +
            `• Erreurs AutoVoc\n` +
            `• Erreurs de stream\n` +
            `• Problèmes MongoDB`;

        msg.edit(statusMessage).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 10000);

    } catch (error) {
        console.error("[ALERTS] Error showing status:", error);
        msg.edit("❌ Erreur lors de l'affichage du statut").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}

export async function getAlertsEnabled(db: Db | null): Promise<boolean> {
    if (!db) return false;

    try {
        const alertsConfig = await db.collection("bot_state").findOne({ _id: "alerts_config" } as any);
        return alertsConfig?.enabled || false;
    } catch (error) {
        console.error("[ALERTS] Error getting alerts status:", error);
        return false;
    }
}

export async function sendAlert(msg: string, userId: string, client: any, db: Db | null) {
    try {
        const alertsEnabled = await getAlertsEnabled(db);
        if (!alertsEnabled) return;

        const user = await client.users.fetch(userId);
        if (user) {
            await user.send(`🚨 **Alerte Bot**\n\n${msg}`).catch(() => {
                console.log("[ALERTS] Failed to send DM alert");
            });
            console.log(`[ALERTS] Alert sent: ${msg}`);
        }
    } catch (error) {
        console.error("[ALERTS] Error sending alert:", error);
    }
}
