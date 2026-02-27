import type { Message } from "discord.js-selfbot-v13";

export async function helpCommand(msg: Message) {
    const helpMessage = `**LISTE DES COMMANDES**\n\n` +
        `**STREAMING**\n` +
        `\`$play-live <url>\` - Streamer une vidéo en mode Go Live\n` +
        `\`$play-cam <url>\` - Streamer une vidéo en mode caméra\n` +
        `\`$stop-stream\` - Arrêter le stream en cours\n` +
        `\`$disconnect\` - Déconnecter du canal vocal\n\n` +
        
        `**CONTROLE VOCAL**\n` +
        `\`$join\` - Rejoindre votre canal vocal\n` +
        `\`$mute\` - Activer le mute\n` +
        `\`$unmute\` - Désactiver le mute\n` +
        `\`$deaf\` - Activer le casque mute\n` +
        `\`$undeaf\` - Désactiver le casque mute\n\n` +
        
        `**AUTOVOC**\n` +
        `\`$autovoc <channel_id>\` - Activer l'AutoVoc sur un canal\n` +
        `\`$autovoc off\` - Désactiver l'AutoVoc\n\n` +
        
        `**INFORMATIONS**\n` +
        `\`$uptime\` - Statut et uptime du bot\n` +
        `\`$health\` - Check système complet\n` +
        `\`$config\` - Afficher la configuration\n` +
        `\`$help\` - Afficher cette aide\n\n` +
        
        `**UTILITAIRES**\n` +
        `\`$clear <nombre>\` - Supprimer vos messages\n` +
        `\`$clearall\` - Supprimer tous vos messages\n` +
        `\`$find <texte>\` - Rechercher un message\n` +
        `\`$gs\` - DM en masse (session interactive)\n` +
        `\`$restart\` - Redémarrer le bot\n\n` +
        
        `**PROGRAMMATION**\n` +
        `\`$schedule <temps> <commande>\` - Programmer une commande\n` +
        `\`$schedule list\` - Liste des tâches programmées\n` +
        `\`$schedule clear\` - Annuler toutes les tâches\n\n` +
        
        `**ALERTES**\n` +
        `\`$alerts on\` - Activer les notifications\n` +
        `\`$alerts off\` - Désactiver les notifications\n` +
        `\`$alerts status\` - Statut des alertes`;
    
    msg.edit(helpMessage).catch(() => {});
    setTimeout(() => msg.delete().catch(() => {}), 30000);
}
