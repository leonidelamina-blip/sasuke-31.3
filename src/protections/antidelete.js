'use strict';
const store = require('../services/messageStore');
const { ativo } = require('../services/protecao');
const { jidToNumber } = require('../utils/helpers');

// Só repõe mensagens que o bot JÁ recebeu (guardadas em memória). Não recupera nada que o bot não viu.
module.exports = {
  name: 'antidelete',
  async onMessage(ctx) {
    if (!ctx.isGroup || ctx.type !== 'protocolMessage') return false;
    const pm = ctx.content.protocolMessage;
    if (!(pm?.type === 0 || pm?.type === 'REVOKE') || !pm.key?.id) return false;
    if (!ativo(ctx.db, ctx.jid, 'antidelete')) return false;
    const orig = store.find(ctx.jid, pm.key.id);
    if (!orig) return false;
    const autor = orig.key.participant || ctx.sender;
    const n = jidToNumber(autor);
    await ctx.send({ text: `🩸 @${n} apagou uma mensagem. Conteúdo reposto abaixo:`, mentions: [autor] }, { quoted: null }).catch(() => {});
    try {
      await ctx.scheduler.enqueue(ctx.jid, 'text', (s) => s.sendMessage(ctx.jid, { forward: orig }), { typing: false });
    } catch {
      const t = orig.message?.conversation || orig.message?.extendedTextMessage?.text;
      if (t) await ctx.send({ text: t }, { quoted: null }).catch(() => {});
      else await ctx.send({ text: '⚠️ Não consegui repor este tipo de conteúdo.' }, { quoted: null }).catch(() => {});
    }
    return false;
  },
};
