import type { Message } from "discord.js-selfbot-v13";

export async function clearCommand(msg: Message, args: string[], currentSessionStart: number) {
    if (args.length < 2) {
        console.log("[CLEAR] No count provided");
        msg.edit("Usage: $clear <nombre>").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    const count = parseInt(args[1]);
    if (isNaN(count) || count < 1 || count > 100) {
        console.log("[CLEAR] Invalid count");
        msg.edit("Nombre invalide (1-100)").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    try {
        console.log(`[CLEAR] Fetching messages to delete ${count} of user's messages`);
        console.log(`[CLEAR] Channel type: ${msg.channel.type}`);
        
        // Récupérer les messages du channel (fonctionne en DM et serveur)
        let messages;
        try {
            messages = await (msg.channel as any).messages.fetch({ limit: 100 });
        } catch (fetchError) {
            console.error(`[CLEAR] Failed to fetch messages:`, fetchError);
            msg.edit("Impossible de recuperer les messages").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        console.log(`[CLEAR] Fetched ${messages.size} messages`);
        
        // Filtrer uniquement les messages de l'utilisateur
        const userMessages = messages.filter((m: any) => m.author.id === msg.author.id);
        console.log(`[CLEAR] Found ${userMessages.size} user messages`);
        
        // Prendre les X premiers messages
        const toDelete = Array.from(userMessages.values()).slice(0, count);
        
        console.log(`[CLEAR] Will delete ${toDelete.length} messages`);
        
        // Supprimer les messages un par un
        let deleted = 0;
        for (const message of toDelete) {
            try {
                await (message as any).delete();
                deleted++;
                console.log(`[CLEAR] Deleted message ${deleted}/${toDelete.length}`);
                // Petit délai pour éviter le rate limit
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.log(`[CLEAR] Failed to delete message:`, error);
            }
        }
        
        console.log(`[CLEAR] Deleted ${deleted} messages in total`);
        msg.edit(`${deleted} messages supprimes`).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        
    } catch (error) {
        console.error("[CLEAR] Error:", error);
        msg.edit("Erreur lors de la suppression").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}
