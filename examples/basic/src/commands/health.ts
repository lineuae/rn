import type { Message } from "discord.js-selfbot-v13";
import type { Db } from "mongodb";
import * as os from "os";

export async function healthCommand(msg: Message, currentSessionStart: number, db: Db | null, streamer: any, getAutoVocState: () => Promise<any>) {
    try {
        const uptimeMs = Date.now() - currentSessionStart;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        
        let uptimeStr = "";
        if (days > 0) uptimeStr += `${days}j `;
        if (hours > 0) uptimeStr += `${hours}h `;
        if (minutes > 0) uptimeStr += `${minutes}m`;
        if (!uptimeStr) uptimeStr = "< 1m";
        
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const memRssMB = Math.round(memUsage.rss / 1024 / 1024);
        
        const totalMemGB = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10;
        const freeMemGB = Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10;
        const usedMemGB = Math.round((totalMemGB - freeMemGB) * 10) / 10;
        const memPercent = Math.round((usedMemGB / totalMemGB) * 100);
        
        const cpuUsage = process.cpuUsage();
        const cpuPercent = Math.round((cpuUsage.user + cpuUsage.system) / 1000000);
        
        const loadAvg = os.loadavg();
        const load1min = Math.round(loadAvg[0] * 100) / 100;
        
        const systemUptime = os.uptime();
        const sysDays = Math.floor(systemUptime / 86400);
        const sysHours = Math.floor((systemUptime % 86400) / 3600);
        const sysUptimeStr = `${sysDays}j ${sysHours}h`;
        
        const mongoStatus = db ? "Connecté" : "Déconnecté";
        
        let autoVocStatus = "Désactivé";
        try {
            const autoVocState = await getAutoVocState();
            if (autoVocState && autoVocState.enabled) {
                const currentVoiceState = streamer.client.user?.voice;
                const isInChannel = currentVoiceState?.channelId === autoVocState.channelId;
                autoVocStatus = isInChannel ? "Actif & Connecté" : "Actif mais déconnecté";
            }
        } catch (e) {
            autoVocStatus = "Erreur";
        }
        
        const voiceStatus = streamer.voiceConnection ? "Connecté" : "Déconnecté";
        
        const platform = process.platform;
        const nodeVersion = process.version;
        const cpuModel = os.cpus()[0]?.model || "Unknown";
        const cpuCores = os.cpus().length;
        
        let healthStatus = "Excellent";
        if (memPercent > 90 || load1min > cpuCores * 2) {
            healthStatus = "Attention";
        }
        if (memPercent > 95 || load1min > cpuCores * 4) {
            healthStatus = "Critique";
        }
        
        const healthMessage = `**CHECK SYSTEME COMPLET**\n\n` +
            `**Etat Général:** ${healthStatus}\n\n` +
            
            `**UPTIME**\n` +
            `Bot: \`${uptimeStr}\`\n` +
            `Système: \`${sysUptimeStr}\`\n\n` +
            
            `**MEMOIRE**\n` +
            `Bot (Heap): \`${memUsedMB}MB / ${memTotalMB}MB\`\n` +
            `Bot (RSS): \`${memRssMB}MB\`\n` +
            `Système: \`${usedMemGB}GB / ${totalMemGB}GB (${memPercent}%)\`\n` +
            `Disponible: \`${freeMemGB}GB\`\n\n` +
            
            `**CPU**\n` +
            `Modèle: \`${cpuModel.substring(0, 30)}...\`\n` +
            `Cœurs: \`${cpuCores}\`\n` +
            `Charge (1min): \`${load1min}\`\n\n` +
            
            `**CONNEXIONS**\n` +
            `MongoDB: ${mongoStatus}\n` +
            `Vocal: ${voiceStatus}\n` +
            `AutoVoc: ${autoVocStatus}\n\n` +
            
            `**SYSTEME**\n` +
            `Plateforme: \`${platform}\`\n` +
            `Node.js: \`${nodeVersion}\`\n` +
            `Compte: \`${streamer.client.user?.tag}\``;
        
        msg.edit(healthMessage).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 20000);
        
    } catch (error) {
        console.error("[HEALTH] Error:", error);
        msg.edit("**ERREUR**\nErreur lors du check système").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}
