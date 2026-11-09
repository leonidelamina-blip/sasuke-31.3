'use strict';
const { ativo, isento, punir } = require('../services/protecao');
const { norm } = require('../utils/format');

const PALAVRAS = ['porra', 'caralho', 'merda', 'puta', 'putas', 'fdp', 'foda', 'fodase', 'foder', 'cona', 'buceta', 'viado', 'cabrao', 'cabra', 'otario', 'idiota', 'imbecil', 'arrombado', 'cuzao', 'babaca'];
const RE = new RegExp(`(^|[^a-z0-9])(${PALAVRAS.join('|')})([^a-z0-9]|$)`);

module.exports = {
  name: 'antipalavrao',
  PALAVRAS,
  async onMessage(ctx) {
    if (!ctx.isGroup || isento(ctx) || !ctx.text || !ativo(ctx.db, ctx.jid, 'antipalavrao')) return false;
    if (!RE.test(norm(ctx.text))) return false;
    await punir(ctx, 'usou linguagem imprópria.');
    return true;
  },
};
