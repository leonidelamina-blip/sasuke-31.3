'use strict';
const { norm } = require('../utils/format');
const { render } = require('../services/welcome');

const cooldown = new Map();
const palavras = (s) => ` ${norm(s).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;

/** Devolve o gatilho que corresponde ao texto (frase completa, por palavras). */
function combinar(texto, gatilhos) {
  const t = palavras(texto);
  return gatilhos.find((g) => t.includes(palavras(g.gatilho))) || null;
}

module.exports = {
  name: 'nano',
  combinar,
  async onMessage(ctx) {
    if (!ctx.isGroup || !ctx.text || ctx.text.trim().startsWith(ctx.config.prefixo)) return false;
    const n = ctx.db.get('nano').grupos[ctx.jid];
    if (!n || !n.ativo || !n.gatilhos.length) return false;
    const g = combinar(ctx.text, n.gatilhos);
    if (!g) return false;
    const k = `${ctx.jid}|${g.id}`;
    if (Date.now() - (cooldown.get(k) || 0) < 10000) return false;
    cooldown.set(k, Date.now());
    const resposta = render(g.resposta, { nome: ctx.pushName || ctx.number, numero: ctx.number, grupo: ctx.meta?.subject || '' });
    await ctx.reply(resposta).catch(() => {});
    return false;
  },
};
