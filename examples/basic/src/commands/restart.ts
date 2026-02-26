import type { Message } from "discord.js-selfbot-v13";

export async function restartCommand(msg: Message) {
    try {
        console.log("[RESTART] Restart command received");
        msg.edit("🔄 Redémarrage du bot en cours...").catch(() => {});
        
        setTimeout(() => {
            console.log("[RESTART] Exiting process for restart");
            process.exit(0);
        }, 2000);
        
    } catch (error) {
        console.error("[RESTART] Error:", error);
        msg.edit("❌ Erreur lors du redémarrage").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}
