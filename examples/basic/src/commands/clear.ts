import type { Message } from "discord.js-selfbot-v13";

export async function clearCommand(msg: Message, args: string[], currentSessionStart: number) {
    if (args.length < 2) {
        msg.edit("Usage: $clear <nombre>").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    const count = parseInt(args[1]);
    if (isNaN(count) || count < 1 || count > 100) {
        msg.edit("Nombre invalide (1-100)").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    try {
        // Récupérer les messages du channel (fonctionne en DM et serveur)
        let messages;
        try {
            messages = await (msg.channel as any).messages.fetch({ limit: 100 });
        } catch (fetchError) {
            msg.edit("Impossible de recuperer les messages").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }
        
        // Filtrer uniquement les messages de l'utilisateur
        const userMessages = messages.filter((m: any) => m.author.id === msg.author.id);
        
        // Prendre les X premiers messages
        const toDelete = Array.from(userMessages.values()).slice(0, count);
        
        // Supprimer les messages un par un
        let deleted = 0;
        for (const message of toDelete) {
            try {
                await (message as any).delete();
                deleted++;
                // Petit délai pour éviter le rate limit
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                // Ignore delete errors
            }
        }
        
        msg.edit(`${deleted} messages supprimes`).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        
    } catch (error) {
        msg.edit("Erreur lors de la suppression").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}
