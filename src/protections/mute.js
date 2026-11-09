'use strict';
// Participantes silenciados (.mute): as suas mensagens são apagadas.
module.exports = {
  name: 'mute',
  async onMessage(ctx) {
    if (!ctx.isGroup || ctx.isAdmin || ctx.isOwner) return false;
    const cfg = ctx.db.groupConfig(ctx.jid);
    if (!cfg.mutados.includes(ctx.number)) return false;
    if (!ctx.botIsAdmin) return false;
    await ctx.admin((s) => s.sendMessage(ctx.jid, { delete: ctx.msg.key })).catch(() => {});
    return true;
  },
};
