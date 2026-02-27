import type { Message } from "discord.js-selfbot-v13";

type GSState = {
    recipients: string[];
    message: string;
};

// Etat en mémoire, 1 session GS par auteur
const gsStates: Map<string, GSState> = new Map();

export async function gsCommand(msg: Message, args: string[], client: any) {
    const authorId = msg.author.id;

    if (args.length < 2) {
        msg.edit(
            "**GS**\n\n" +
            "Sous-commandes:\n" +
            "`$gs start` - Démarrer une session\n" +
            "`$gs add <@ID ...>` - Ajouter des destinataires\n" +
            "`$gs remove <@ID ...>` - Retirer des destinataires\n" +
            "`$gs list` - Voir la liste\n" +
            "`$gs msg <texte>` - Définir le message\n" +
            "`$gs clear` - Vider la liste + message\n" +
            "`$gs send` - Envoyer les DMs\n" +
            "`$gs stop` - Annuler la session"
        ).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 15000);
        return;
    }

    const sub = args[1].toLowerCase();

    if (sub === "start") {
        gsStates.set(authorId, { recipients: [], message: "" });
        msg.edit(
            "**GS**\nSession démarrée.\n\n" +
            "Ajoute des personnes avec: `gs add <@ID ...>`\n" +
            "Définis le message avec: `gs msg <texte>`\n" +
            "Puis envoie avec: `gs send`"
        ).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 10000);
        return;
    }

    const state = gsStates.get(authorId);
    if (!state) {
        msg.edit("**GS**\nAucune session active. Fais: `$gs start`").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 8000);
        return;
    }

    if (sub === "stop") {
        gsStates.delete(authorId);
        msg.edit("**GS**\nSession annulée.").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 8000);
        return;
    }

    if (sub === "clear") {
        state.recipients = [];
        state.message = "";
        msg.edit("**GS**\nListe et message réinitialisés.").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 8000);
        return;
    }

    if (sub === "list") {
        const recipientsPreview = state.recipients.length
            ? state.recipients.map(id => `<@${id}>`).join(" ")
            : "(vide)";

        const messagePreview = state.message
            ? (state.message.length > 300 ? state.message.slice(0, 300) + "..." : state.message)
            : "(non défini)";

        msg.edit(
            "**GS**\n\n" +
            `Destinataires (${state.recipients.length}): ${recipientsPreview}\n\n` +
            `Message: \n\`\`\`\n${messagePreview}\n\`\`\``
        ).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 20000);
        return;
    }

    if (sub === "add" || sub === "remove") {
        if (args.length < 3) {
            msg.edit(`**GS**\nUsage: \`$gs ${sub} <@ID ...>\``).catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 8000);
            return;
        }

        const ids = parseUserIds(args.slice(2).join(" "));
        if (ids.length === 0) {
            msg.edit("**GS**\nAucun ID valide détecté. Exemple: `$gs add <@123> 456` ").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 8000);
            return;
        }

        if (sub === "add") {
            for (const id of ids) {
                if (!state.recipients.includes(id)) state.recipients.push(id);
            }
            msg.edit(`**GS**\nAjouté. Total: ${state.recipients.length}`).catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 8000);
            return;
        }

        // remove
        state.recipients = state.recipients.filter(id => !ids.includes(id));
        msg.edit(`**GS**\nRetiré. Total: ${state.recipients.length}`).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 8000);
        return;
    }

    if (sub === "msg") {
        const text = args.slice(2).join(" ").trim();
        if (!text) {
            msg.edit("**GS**\nUsage: `$gs msg <texte>`").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 8000);
            return;
        }

        state.message = text;
        msg.edit("**GS**\nMessage enregistré.").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 8000);
        return;
    }

    if (sub === "send") {
        if (state.recipients.length === 0) {
            msg.edit("**GS**\nAucun destinataire. Ajoute avec `$gs add ...` ").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 8000);
            return;
        }
        if (!state.message) {
            msg.edit("**GS**\nAucun message défini. Fais `$gs msg <texte>`").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 8000);
            return;
        }

        msg.edit(
            "**GS**\nEnvoi en cours...\n" +
            `Destinataires: ${state.recipients.length}\n` +
            "(un délai est appliqué entre chaque DM)"
        ).catch(() => {});

        let ok = 0;
        let fail = 0;

        for (const userId of state.recipients) {
            try {
                const user = await client.users.fetch(userId);
                await user.send(state.message);
                ok++;
            } catch (e) {
                fail++;
            }

            // délai anti rate-limit
            await new Promise(resolve => setTimeout(resolve, 1200));
        }

        msg.edit(
            "**GS**\nEnvoi terminé.\n\n" +
            `OK: ${ok}\n` +
            `Échecs: ${fail}`
        ).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 15000);

        gsStates.delete(authorId);
        return;
    }

    msg.edit("**GS**\nSous-commande inconnue. Fais `$gs` pour l'aide.").catch(() => {});
    setTimeout(() => msg.delete().catch(() => {}), 8000);
}

function parseUserIds(input: string): string[] {
    const ids = new Set<string>();

    // captures: <@123>, <@!123>, 123
    const mentionRegex = /<@!?(\d{5,})>/g;
    const idRegex = /\b(\d{5,})\b/g;

    let m: RegExpExecArray | null;
    while ((m = mentionRegex.exec(input)) !== null) {
        ids.add(m[1]);
    }
    while ((m = idRegex.exec(input)) !== null) {
        ids.add(m[1]);
    }

    return Array.from(ids);
}
