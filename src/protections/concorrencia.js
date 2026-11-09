'use strict';
const { ativo, isento, punir } = require('../services/protecao');
const { norm } = require('../utils/format');

// Anúncio de concorrência = palavras de VENDA + contacto (telefone ou link de WhatsApp). Heurística: pode ter falsos positivos.
const VENDA = /\b(vendo|vendemos|venda|vendas|promocao|promocoes|revenda|revendedor|reseller)\b/;
const CONTACTO = new RegExp('(?<!\\d)(?:258)?8[2-7]\\d{7}(?!\\d)|wa\\.me/|chat\\.whatsapp\\.com/');

module.exports = {
  name: 'anticoncorrencia',
  async onMessage(ctx) {
    if (!ctx.isGroup || isento(ctx) || !ctx.text || !ativo(ctx.db, ctx.jid, 'anticoncorrencia')) return false;
    const t = norm(ctx.text);
    if (!VENDA.test(t) || !CONTACTO.test(t)) return false;
    await punir(ctx, 'enviou um anúncio de venda. Não é permitido concorrência neste grupo.');
    return true;
  },
};
