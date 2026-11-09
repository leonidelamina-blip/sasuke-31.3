'use strict';
const tk = require('../services/tokenStore');
const { userError } = require('../utils/format');
const { formatDate } = require('../utils/helpers');

const T = { category: 'OUTROS • ADMINISTRAÇÃO', level: 'dono', nuncaLiberar: true, free: true };
const soPrivado = (ctx) => { if (ctx.isGroup) throw userError('Por segurança, usa este comando no PRIVADO comigo (nunca num grupo).'); };
const AVISO = 'ℹ️ O token fica em database/token.json. Ainda nenhuma função do bot o usa (não há painel ligado): serve para integrações futuras. Apaga esta mensagem depois de guardares.';

module.exports = [
  {
    ...T, name: 'token', reaction: '🔐', desc: 'Dono (privado): mostra o token actual ou gera um novo (.token novo)',
    async run(ctx) {
      soPrivado(ctx);
      const novo = (ctx.args[0] || '').toLowerCase() === 'novo';
      if (novo || !tk.atual(ctx.db)) tk.definir(ctx.db, tk.gerar(), ctx.number);
      const d = tk.dados(ctx.db);
      await ctx.reply(`🔐 TOKEN${novo ? ' (novo)' : ''}\n\n${d.token}\n\n🕒 Criado: ${formatDate(d.criadoEm, ctx.config.fusoHorario)}\n${AVISO}`);
    },
  },
  {
    ...T, name: 'settoken', reaction: '🔏', desc: 'Dono (privado): define o token manualmente (.settoken <16+ caracteres>)',
    async run(ctx) {
      soPrivado(ctx);
      const t = ctx.args[0];
      if (!tk.valido(t)) throw userError('Uso: .settoken <token> — 16 a 128 caracteres (letras, números, . _ -)');
      tk.definir(ctx.db, t, ctx.number);
      await ctx.reply(`🔏 Token definido (termina em …${t.slice(-4)}). O anterior continua válido 24 h.\n${AVISO}`);
    },
  },
  {
    ...T, name: 'migrartoken', reaction: '🔁', desc: 'Dono (privado): roda o token (gera novo; o antigo vale mais 24 h)',
    async run(ctx) {
      soPrivado(ctx);
      const tinha = !!tk.atual(ctx.db);
      tk.definir(ctx.db, tk.gerar(), ctx.number);
      const d = tk.dados(ctx.db);
      await ctx.reply(`🔁 Token rodado.\n\nNovo: ${d.token}\n${tinha ? `⏳ O anterior vale até ${formatDate(d.anteriorAte, ctx.config.fusoHorario)}.` : 'Não havia token anterior.'}\n${AVISO}`);
    },
  },
];
