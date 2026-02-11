import type { Message } from "discord.js-selfbot-v13";

export async function clearallCommand(msg: Message, currentSessionStart: number) {
    
    try {
        console.log("[CLEARALL] Starting to delete all user messages in channel");
        
        let totalDeleted = 0;
        let hasMore = true;
        
        while (hasMore) {
            // Récupérer les messages du channel par batch de 100
            const messages = await msg.channel.messages.fetch({ limit: 100 });
            
            // Filtrer uniquement les messages de l'utilisateur
            const userMessages = messages.filter((m: any) => m.author.id === msg.author.id);
            
            if (userMessages.size === 0) {
                hasMore = false;
                break;
            }
            
            console.log(`[CLEARALL] Found ${userMessages.size} messages in this batch`);
            
            // Supprimer les messages un par un
            for (const [, message] of userMessages) {
                try {
                    await (message as any).delete();
                    totalDeleted++;
                    // Petit délai pour éviter le rate limit
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.log(`[CLEARALL] Failed to delete message:`, error);
                }
            }
            
            // Si on a récupéré moins de 100 messages, c'est qu'il n'y en a plus
            if (messages.size < 100) {
                hasMore = false;
            }
        }
        
        console.log(`[CLEARALL] Deleted ${totalDeleted} messages in total`);
        msg.edit(`${totalDeleted} messages supprimes`).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        
    } catch (error) {
        console.error("[CLEARALL] Error:", error);
        msg.edit("Erreur lors de la suppression").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}
