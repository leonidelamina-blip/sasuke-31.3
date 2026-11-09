'use strict';
const commerce = require('../services/commerce');
const { resolverGrupo } = require('../utils/grupos');
const { userError, quotedText } = require('../utils/format');

const C = 'Aluguer';
const G = { categoria: C, groupOnly: true, level: 'admin', nuncaLiberar: true };
const MAXLEN = 3000;

// Configuração por grupo: só administradores do grupo (ou o proprietário) — o ID do grupo isola os dados.
const set = (name, campo, rotulo) => ({
  ...G, name, reaction: '✅', descricao: `Define ${rotulo} do grupo`,
  async run(ctx) {
    const a = (ctx.args[0] || '').toLowerCase();
    if (a === 'apagar' && ctx.args.length === 1) { commerce.setCampo(ctx.db, ctx.jid, campo, null, ctx.number); return ctx.reply(`🗑️ ${rotulo} apagado(a).`); }
    const t = (ctx.argText || quotedText(ctx)).trim();
    if (!t) throw userError(`Uso: .${name} <texto>  (ou responde a uma mensagem)  ·  .${name} apagar`);
    if (t.length > MAXLEN) throw userError(`Máximo de ${MAXLEN} caracteres.`);
    commerce.setCampo(ctx.db, ctx.jid, campo, t, ctx.number);
    await ctx.reply(`✅ ${rotulo} actualizado(a) para este grupo.`);
  },
});

const dono = { categoria: C, level: 'dono', nuncaLiberar: true, free: true };

module.exports = [
  set('settabela', 'tabela', 'a tabela'),
  set('setpagamento', 'pagamento', 'o pagamento'),
  set('setmegas', 'megas', 'os megas'),
  set('setcontas', 'contas', 'as contas'),
  set('setcarteira', 'carteira', 'a carteira'),
  set('setcompra', 'compra', 'as instruções de compra'),
  set('setloja', 'loja', 'a loja'),
  {
    ...dono, name: 'vertabela', reaction: '🔍', descricao: 'Proprietário: vê a tabela de um grupo',
    async run(ctx) {
      const gid = await resolverGrupo(ctx, ctx.args[0], { refresh: true });
      const t = commerce.getCampo(ctx.db, gid, 'tabela');
      await ctx.reply(t ? `💳 TABELA (${ctx.db.groupRecord(gid).nome || gid})\n\n${t}` : 'Este grupo não tem tabela configurada.');
    },
  },
  {
    ...dono, name: 'limpartabela', reaction: '🧹', descricao: 'Proprietário: apaga a tabela de um grupo',
    async run(ctx) {
      const gid = await resolverGrupo(ctx, ctx.args[0], { refresh: true });
      if (!commerce.getCampo(ctx.db, gid, 'tabela')) throw userError('Este grupo não tem tabela configurada.');
      commerce.setCampo(ctx.db, gid, 'tabela', null, ctx.number);
      await ctx.reply(`🧹 Tabela de "${ctx.db.groupRecord(gid).nome || gid}" apagada.`);
    },
  },
  {
    ...dono, name: 'verloja', reaction: '🛒', descricao: 'Proprietário: vê a loja de um grupo',
    async run(ctx) {
      const gid = await resolverGrupo(ctx, ctx.args[0], { refresh: true });
      const t = commerce.getCampo(ctx.db, gid, 'loja');
      await ctx.reply(t ? `🛒 LOJA (${ctx.db.groupRecord(gid).nome || gid})\n\n${t}` : 'Este grupo não tem loja configurada.');
    },
  },
];
