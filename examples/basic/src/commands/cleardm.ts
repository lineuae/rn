import type { Message } from "discord.js-selfbot-v13";

export async function cleardmCommand(msg: Message, args: string[]) {
    if (args.length < 2) {
        msg.edit("Usage: $cleardm <user_id>").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    const userId = args[1].replace(/[<@!>]/g, "");

    try {
        // Trouver le DM channel avec cet utilisateur
        const dmChannel = msg.client.channels.cache.find(
            (ch: any) => ch.type === "DM" && ch.recipient?.id === userId
        );

        if (!dmChannel) {
            msg.edit("Aucun DM trouvé avec cet utilisateur").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }

        let totalDeleted = 0;
        let hasMore = true;

        while (hasMore) {
            let messages;
            try {
                messages = await (dmChannel as any).messages.fetch({ limit: 100 });
            } catch (fetchError) {
                msg.edit("Impossible de récupérer les messages").catch(() => {});
                setTimeout(() => msg.delete().catch(() => {}), 5000);
                return;
            }

            // Filtrer uniquement les messages de l'utilisateur connecté
            const userMessages = messages.filter((m: any) => m.author.id === msg.author.id);

            if (userMessages.size === 0) {
                hasMore = false;
                break;
            }

            // Supprimer les messages un par un
            for (const [, message] of userMessages) {
                try {
                    await (message as any).delete();
                    totalDeleted++;
                    // Délai pour éviter le rate limit
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    // Ignore delete errors
                }
            }

            // Si on a récupéré moins de 100 messages, c'est qu'il n'y en a plus
            if (messages.size < 100) {
                hasMore = false;
            }
        }

        msg.edit(`${totalDeleted} messages supprimés du DM`).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);

    } catch (error) {
        msg.edit("Erreur lors de la suppression").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}
