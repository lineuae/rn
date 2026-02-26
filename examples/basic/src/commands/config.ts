import type { Message } from "discord.js-selfbot-v13";

export async function configCommand(msg: Message, config: any) {
    try {
        const configMessage = `**CONFIGURATION DU BOT**\n\n` +
            `**STREAM**\n` +
            `Résolution: \`${config.streamOpts.width}x${config.streamOpts.height}\`\n` +
            `FPS: \`${config.streamOpts.fps}\`\n` +
            `Bitrate: \`${config.streamOpts.bitrateKbps} kbps\`\n` +
            `Max Bitrate: \`${config.streamOpts.maxBitrateKbps} kbps\`\n` +
            `Codec: \`${config.streamOpts.videoCodec}\`\n` +
            `Hardware Acceleration: ${config.streamOpts.hardware_acceleration ? 'Activé' : 'Désactivé'}\n\n` +
            
            `**UTILISATEURS AUTORISES**\n` +
            `${config.acceptedAuthors.length} utilisateur(s) autorisé(s)\n\n` +
            
            `**BASE DE DONNEES**\n` +
            `MongoDB: ${config.mongo_uri ? 'Configuré' : 'Non configuré'}\n\n` +
            
            `**SECURITE**\n` +
            `Token: ${config.token ? 'Configuré' : 'Non configuré'}`;
        
        msg.edit(configMessage).catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 15000);
        
    } catch (error) {
        console.error("[CONFIG] Error:", error);
        msg.edit("**ERREUR**\nErreur lors de l'affichage de la config").catch(() => {});
        setTimeout(() => msg.delete().catch(() => {}), 5000);
    }
}
