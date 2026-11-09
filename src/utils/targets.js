'use strict';
const { jidToNumber } = require('./helpers');

/** Converte "84xxxxxxx" (9 dígitos moçambicanos) ou número internacional em dígitos internacionais. */
function normNum(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (/^8[2-7]\d{7}$/.test(d)) d = '258' + d;
  return /^\d{10,15}$/.test(d) ? d : null;
}

/** Alvos de um comando: menções, mensagem respondida e números nos argumentos. */
function resolveTargets(ctx, { includeArgs = true, max = 20 } = {}) {
  const out = [];
  const seen = new Set();
  const add = (jid) => {
    const n = jidToNumber(jid);
    if (!n || seen.has(n)) return;
    seen.add(n); out.push(jid);
  };
  for (const m of ctx.mentioned || []) add(m);
  if (!out.length && ctx.quotedSender) add(ctx.quotedSender);
  if (includeArgs) {
    for (const a of ctx.args || []) {
      if (a.startsWith('@')) continue; // já vem em mentioned
      const n = normNum(a);
      if (n) add(n + '@s.whatsapp.net');
    }
  }
  return out.slice(0, max);
}

module.exports = { resolveTargets, normNum };
