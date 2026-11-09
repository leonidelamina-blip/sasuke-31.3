'use strict';
const { ativo, prot, isento, punir } = require('../services/protecao');

const hist = new Map();
setInterval(() => { const n = Date.now(); for (const [k, a] of hist) if (!a.length || n - a[a.length - 1] > 60000) hist.delete(k); }, 60000).unref?.();

module.exports = {
  name: 'antiflood',
  async onMessage(ctx) {
    if (!ctx.isGroup || isento(ctx) || ctx.type === 'protocolMessage' || ctx.type === 'reactionMessage') return false;
    if (!ativo(ctx.db, ctx.jid, 'antiflood')) return false;
    const p = prot(ctx.db, ctx.jid, 'antiflood');
    const max = p.maxMsgs || ctx.config.protecoes.flood.maxMsgs;
    const janela = (p.janelaSeg || ctx.config.protecoes.flood.janelaSeg) * 1000;
    const k = `${ctx.jid}|${ctx.number}`;
    const now = Date.now();
    const a = (hist.get(k) || []).filter((t) => now - t < janela);
    a.push(now);
    hist.set(k, a);
    if (a.length <= max) return false;
    hist.set(k, []);
    await punir(ctx, 'está a enviar mensagens depressa demais (flood).');
    return true;
  },
};
