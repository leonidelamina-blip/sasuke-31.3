'use strict';
const { onOff, userError, norm } = require('../utils/format');

const C = 'Nano';
const G = { categoria: C, groupOnly: true, level: 'admin' };
const MAX = 100;
const dados = (db, gid) => db.groupOf('nano', gid, () => ({ ativo: true, gatilhos: [], seq: 0 }));
const VARS = 'Variáveis na resposta: {nome} {numero} {grupo}';

module.exports = [
  {
    ...G, name: 'nano', reaction: '🤖', descricao: 'Estado e controlo do sistema Nano (gatilhos e respostas)',
    async run(ctx) {
      const d = dados(ctx.db, ctx.jid);
      const st = onOff(ctx.args[0]);
      if (st !== null) { d.ativo = st; ctx.db.save('nano'); return ctx.reply(`🤖 Nano: ${st ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}`); }
      await ctx.reply(`🤖 Nano: ${d.ativo ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n📋 Gatilhos: ${d.gatilhos.length}/${MAX}\n\nUso:\n.nano on/off\n.nanoadd gatilho | resposta\n.nanolist\n.nanodel <nº ou gatilho>\n.limparnano\n\n${VARS}`);
    },
  },
  {
    ...G, name: 'nanoadd', reaction: '🤖', descricao: 'Adiciona um gatilho e resposta',
    async run(ctx) {
      const i = ctx.argText.indexOf('|');
      if (i < 1) throw userError('Uso: .nanoadd gatilho | resposta');
      const gatilho = ctx.argText.slice(0, i).trim();
      const resposta = ctx.argText.slice(i + 1).trim();
      if (!gatilho || !resposta) throw userError('Uso: .nanoadd gatilho | resposta');
      if (gatilho.length > 50) throw userError('O gatilho pode ter no máximo 50 caracteres.');
      if (resposta.length > 1000) throw userError('A resposta pode ter no máximo 1000 caracteres.');
      if (gatilho.startsWith(ctx.config.prefixo)) throw userError('O gatilho não pode começar pelo prefixo dos comandos.');
      const d = dados(ctx.db, ctx.jid);
      const ex = d.gatilhos.find((g) => norm(g.gatilho) === norm(gatilho));
      if (ex) { ex.resposta = resposta; ctx.db.save('nano'); return ctx.reply(`🤖 Gatilho "${ex.gatilho}" actualizado.`); }
      if (d.gatilhos.length >= MAX) throw userError(`Limite de ${MAX} gatilhos atingido.`);
      d.gatilhos.push({ id: ++d.seq, gatilho, resposta, criadoPor: ctx.number, em: Date.now() });
      ctx.db.save('nano');
      await ctx.reply(`🤖 Gatilho adicionado: "${gatilho}" (${d.gatilhos.length}/${MAX})`);
    },
  },
  {
    ...G, level: 'membro', name: 'nanolist', reaction: '📋', descricao: 'Lista os gatilhos do grupo',
    async run(ctx) {
      const d = dados(ctx.db, ctx.jid);
      if (!d.gatilhos.length) return ctx.reply('📋 Ainda não há gatilhos Nano neste grupo.');
      await ctx.reply(`📋 Gatilhos Nano (${d.gatilhos.length}) — ${d.ativo ? 'activo' : 'desactivado'}:\n` + d.gatilhos.map((g, k) => `${k + 1}. ${g.gatilho} → ${g.resposta.slice(0, 60)}${g.resposta.length > 60 ? '…' : ''}`).join('\n'));
    },
  },
  {
    ...G, name: 'nanodel', reaction: '🗑️', descricao: 'Remove um gatilho (nº ou texto)',
    async run(ctx) {
      if (!ctx.argText) throw userError('Uso: .nanodel <número da lista ou gatilho>');
      const d = dados(ctx.db, ctx.jid);
      let idx = /^\d+$/.test(ctx.argText) ? Number(ctx.argText) - 1 : d.gatilhos.findIndex((g) => norm(g.gatilho) === norm(ctx.argText));
      if (idx < 0 || idx >= d.gatilhos.length) throw userError('Gatilho não encontrado. Vê a lista com .nanolist');
      const [r] = d.gatilhos.splice(idx, 1);
      ctx.db.save('nano');
      await ctx.reply(`🗑️ Gatilho "${r.gatilho}" removido.`);
    },
  },
  {
    ...G, name: 'limparnano', reaction: '🧹', descricao: 'Apaga todos os gatilhos do grupo',
    async run(ctx) {
      const d = dados(ctx.db, ctx.jid);
      const n = d.gatilhos.length;
      d.gatilhos = [];
      ctx.db.save('nano');
      await ctx.reply(`🧹 ${n} gatilho(s) apagado(s).`);
    },
  },
];
