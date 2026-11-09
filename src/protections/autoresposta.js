'use strict';
const { botNumbers } = require('../utils/format');
const { jidToNumber } = require('../utils/helpers');

const cooldown = new Map();
const PADRAO = '👁️ Sasuke aqui. Usa .menu para ver os comandos.';

// Responde quando o bot é marcado ou quando respondem a uma mensagem dele.
module.exports = {
  name: 'autoresposta',
  async onMessage(ctx) {
    if (!ctx.isGroup || !ctx.text || ctx.text.trim().startsWith(ctx.config.prefixo)) return false;
    const cfg = ctx.db.groupConfig(ctx.jid);
    if (!cfg.autoresposta) return false;
    const bots = botNumbers(ctx);
    const tocado = ctx.mentioned.some((m) => bots.includes(jidToNumber(m))) || (ctx.quotedSender && bots.includes(jidToNumber(ctx.quotedSender)));
    if (!tocado) return false;
    const k = `${ctx.jid}|${ctx.number}`;
    if (Date.now() - (cooldown.get(k) || 0) < 30000) return false;
    cooldown.set(k, Date.now());
    await ctx.reply(cfg.autorespostaTexto || PADRAO).catch(() => {});
    return false;
  },
};
