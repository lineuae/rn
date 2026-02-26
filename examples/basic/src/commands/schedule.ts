import type { Message } from "discord.js-selfbot-v13";
import type { Db } from "mongodb";

interface ScheduledTask {
    id: string;
    command: string;
    executeAt: number;
    createdAt: number;
}

const scheduledTasks: Map<string, NodeJS.Timeout> = new Map();

export async function scheduleCommand(msg: Message, args: string[], db: Db | null) {
    if (args.length < 2) {
        msg.edit("Usage: `$schedule <temps> <commande>` ou `$schedule list` ou `$schedule clear`").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    const subCommand = args[1].toLowerCase();

    if (subCommand === "list") {
        await listScheduledTasks(msg, db);
        return;
    }

    if (subCommand === "clear") {
        await clearScheduledTasks(msg, db);
        return;
    }

    if (args.length < 3) {
        msg.edit("Usage: `$schedule <temps> <commande>`\nExemple: `$schedule 10m $disconnect`").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    const timeStr = args[1];
    const command = args.slice(2).join(" ");

    const delay = parseTime(timeStr);
    if (delay === null) {
        msg.edit("❌ Format de temps invalide. Utilisez: `10s`, `5m`, `2h`, `1d`").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
        return;
    }

    try {
        const taskId = Date.now().toString();
        const executeAt = Date.now() + delay;

        const timeout = setTimeout(async () => {
            console.log(`[SCHEDULE] Executing scheduled command: ${command}`);
            scheduledTasks.delete(taskId);
            
            if (db) {
                await db.collection("scheduled_tasks").deleteOne({ id: taskId } as any);
            }
        }, delay);

        scheduledTasks.set(taskId, timeout);

        if (db) {
            await db.collection("scheduled_tasks").insertOne({
                id: taskId,
                command,
                executeAt,
                createdAt: Date.now()
            } as any);
        }

        const delayStr = formatDelay(delay);
        msg.edit(`✅ Commande programmée: \`${command}\`\nExécution dans: ${delayStr}`).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);

    } catch (error) {
        console.error("[SCHEDULE] Error:", error);
        msg.edit("❌ Erreur lors de la programmation").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}

async function listScheduledTasks(msg: Message, db: Db | null) {
    try {
        if (!db) {
            msg.edit("❌ Base de données non connectée").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }

        const tasks = await db.collection("scheduled_tasks").find({}).toArray();

        if (tasks.length === 0) {
            msg.edit("📋 Aucune tâche programmée").catch(() => {});
            setTimeout(() => msg.delete().catch(() => {}), 5000);
            return;
        }

        let taskList = "**📋 Tâches Programmées**\n\n";
        tasks.forEach((task: any, index: number) => {
            const timeLeft = task.executeAt - Date.now();
            const timeLeftStr = formatDelay(timeLeft);
            taskList += `${index + 1}. \`${task.command}\` - Dans ${timeLeftStr}\n`;
        });

        msg.edit(taskList).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 15000);

    } catch (error) {
        console.error("[SCHEDULE] Error listing tasks:", error);
        msg.edit("❌ Erreur lors de la récupération des tâches").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}

async function clearScheduledTasks(msg: Message, db: Db | null) {
    try {
        scheduledTasks.forEach(timeout => clearTimeout(timeout));
        scheduledTasks.clear();

        if (db) {
            await db.collection("scheduled_tasks").deleteMany({});
        }

        msg.edit("✅ Toutes les tâches programmées ont été annulées").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);

    } catch (error) {
        console.error("[SCHEDULE] Error clearing tasks:", error);
        msg.edit("❌ Erreur lors de l'annulation des tâches").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}

function parseTime(timeStr: string): number | null {
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: { [key: string]: number } = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
}

function formatDelay(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

export async function loadScheduledTasks(db: Db | null) {
    if (!db) return;

    try {
        const tasks = await db.collection("scheduled_tasks").find({}).toArray();
        const now = Date.now();

        for (const task of tasks as any[]) {
            const delay = task.executeAt - now;

            if (delay <= 0) {
                await db.collection("scheduled_tasks").deleteOne({ id: task.id } as any);
                continue;
            }

            const timeout = setTimeout(async () => {
                console.log(`[SCHEDULE] Executing scheduled command: ${task.command}`);
                scheduledTasks.delete(task.id);
                await db.collection("scheduled_tasks").deleteOne({ id: task.id } as any);
            }, delay);

            scheduledTasks.set(task.id, timeout);
        }

        console.log(`[SCHEDULE] Loaded ${scheduledTasks.size} scheduled tasks`);
    } catch (error) {
        console.error("[SCHEDULE] Error loading tasks:", error);
    }
}
