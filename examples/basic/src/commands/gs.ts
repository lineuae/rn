import type { Message } from "discord.js-selfbot-v13";
import type { Db } from "mongodb";

const MAX_GS_RECIPIENTS = 50;
const GS_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

type GSState = {
    recipients: string[];
    message: string;
    awaitingConfirm?: boolean;
    delayMs?: number;
};

// Etat en mémoire, 1 session GS par auteur
const gsStates: Map<string, GSState> = new Map();

async function getLastGsRun(db: Db | undefined): Promise<number | null> {
    if (!db) return null;
    try {
        const doc = await db.collection("bot_state").findOne<{ lastRunAt: number }>({ _id: "gs_last_run" } as any);
        return doc?.lastRunAt ?? null;
    } catch (error) {
        console.error("[GS] Failed to read last GS run from Mongo:", error);
        return null;
    }
}

async function setLastGsRun(db: Db | undefined, timestamp: number): Promise<void> {
    if (!db) return;
    try {
        await db.collection("bot_state").updateOne(
            { _id: "gs_last_run" } as any,
            { $set: { lastRunAt: timestamp } },
            { upsert: true }
        );
    } catch (error) {
        console.error("[GS] Failed to persist last GS run in Mongo:", error);
    }
}

export async function gsCommand(msg: Message, args: string[], client: any, db?: Db) {
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
            "`$gs delay <ms>` - Régler le délai entre DMs (ex: 3500)\n" +
            "`$gs clear` - Vider la liste + message\n" +
            "`$gs send` - Préparer l'envoi (demande confirmation)\n" +
            "`$gs confirm` - Confirmer l'envoi\n" +
            "`$gs stop` - Annuler la session"
        ).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 15000);
        return;
    }

    const sub = args[1].toLowerCase();

    if (sub === "start") {
        if (db) {
            const lastRun = await getLastGsRun(db);
            if (lastRun) {
                const elapsed = Date.now() - lastRun;
                if (elapsed < GS_COOLDOWN_MS) {
                    const remainingMs = GS_COOLDOWN_MS - elapsed;
                    const remainingSec = Math.floor(remainingMs / 1000);
                    const m = Math.floor(remainingSec / 60);
                    const s = remainingSec % 60;
                    msg.edit(
                        `**GS**\nCooldown global actif. Réessaie dans ${m}m${s.toString().padStart(2, "0")}s.`
                    ).catch(() => {});
                    setTimeout(() => msg.delete().catch(() => {}), 8000);
                    return;
                }
            }
        }

        gsStates.set(authorId, { recipients: [], message: "", awaitingConfirm: false, delayMs: 3500 });
        msg.edit(
            "**GS**\nSession démarrée.\n\n" +
            "Ajoute des personnes avec: `gs add <@ID ...>`\n" +
            "Définis le message avec: `gs msg <texte>`\n" +
            "Puis fais: `gs send` et `gs confirm`"
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
        state.awaitingConfirm = false;

        if (db) {
            await setLastGsRun(db, Date.now());
        }
        msg.edit("**GS**\nListe et message réinitialisés.").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 8000);
        return;
    }

    if (sub === "delay") {
        const raw = args[2];
        const delay = raw ? parseInt(raw) : NaN;
        if (!raw || isNaN(delay) || delay < 1200 || delay > 30000) {
            msg.edit("**GS**\nUsage: `$gs delay <ms>`\nMin: 1200ms, Max: 30000ms\nExemple: `$gs delay 3500`").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 12000);
            return;
        }

        state.delayMs = delay;
        msg.edit(`**GS**\nDélai réglé à: ${delay}ms`).catch(() => {});
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
            let added = 0;
            for (const id of ids) {
                if (state.recipients.length >= MAX_GS_RECIPIENTS) break;
                if (!state.recipients.includes(id)) {
                    state.recipients.push(id);
                    added++;
                }
            }
            state.awaitingConfirm = false;

            if (added === 0 && state.recipients.length >= MAX_GS_RECIPIENTS) {
                msg.edit(
                    `**GS**\nLimite de ${MAX_GS_RECIPIENTS} destinataires atteinte. Aucun ID supplémentaire ajouté.`
                ).catch(() => {});
            } else if (state.recipients.length >= MAX_GS_RECIPIENTS) {
                msg.edit(
                    `**GS**\nAjouté. Total: ${state.recipients.length} (limite atteinte: ${MAX_GS_RECIPIENTS}).`
                ).catch(() => {});
            } else {
                msg.edit(`**GS**\nAjouté. Total: ${state.recipients.length}`).catch(() => {});
            }
            setTimeout(() => msg.delete().catch(() => {}), 8000);
            return;
        }

        // remove
        state.recipients = state.recipients.filter(id => !ids.includes(id));
        state.awaitingConfirm = false;
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
        state.awaitingConfirm = false;
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

        state.awaitingConfirm = true;

        const recipientsPreview = state.recipients.slice(0, 25).map(id => `<@${id}>`).join(" ") + (state.recipients.length > 25 ? " ..." : "");
        const delay = state.delayMs ?? 3500;
        const messagePreview = state.message.length > 400 ? state.message.slice(0, 400) + "..." : state.message;

        msg.edit(
            "**GS**\nConfirmation requise.\n\n" +
            `Destinataires: ${state.recipients.length}\n` +
            `Délai: ${delay}ms (+ jitter aléatoire)\n\n` +
            `Limite par campagne: ${MAX_GS_RECIPIENTS} destinataires\n` +
            `Cooldown global: ${Math.floor(GS_COOLDOWN_MS / 60000)} minutes\n` +
            "⚠️ Mass DM: risque de rate-limit/ban si vous envoyez trop de DMs ou trop vite.\n\n" +
            `Liste (aperçu): ${recipientsPreview}\n\n` +
            `Message (aperçu):\n\`\`\`\n${messagePreview}\n\`\`\`\n\n` +
            "Pour envoyer: `$gs confirm`\n" +
            "Pour annuler: `$gs stop`"
        ).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 30000);
        return;
    }

    if (sub === "confirm") {
        if (!state.awaitingConfirm) {
            msg.edit("**GS**\nRien à confirmer. Fais `$gs send` d'abord.").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 8000);
            return;
        }

        state.awaitingConfirm = false;

        msg.edit(
            "**GS**\nEnvoi en cours...\n" +
            `Destinataires: ${state.recipients.length}\n` +
            "(un délai est appliqué entre chaque DM)"
        ).catch(() => {});

        let ok = 0;
        const failedIds: string[] = [];

        const baseDelay = state.delayMs ?? 3500;

        for (const userId of state.recipients) {
            try {
                const user = await client.users.fetch(userId);
                await user.send(state.message);
                ok++;
            } catch (e) {
                failedIds.push(userId);
            }

            // délai anti rate-limit (plus humain): base + jitter aléatoire
            const jitter = Math.floor(baseDelay * (0.25 * Math.random()));
            const finalDelay = baseDelay + jitter;
            await new Promise(resolve => setTimeout(resolve, finalDelay));
        }

        const fail = failedIds.length;
        const failedPreview = fail
            ? (failedIds.length > 30 ? failedIds.slice(0, 30).join(", ") + " ..." : failedIds.join(", "))
            : "(aucun)";

        msg.edit(
            "**GS**\nEnvoi terminé.\n\n" +
            `OK: ${ok}\n` +
            `Échecs: ${fail}\n\n` +
            `IDs en échec: ${failedPreview}`
        ).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 20000);

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
