'use strict';
const { LEVELS } = require('../services/permissions');
const { resolveTargets } = require('../utils/targets');
const { userError, tag } = require('../utils/format');
const { jidToNumber } = require('../utils/helpers');

const C = 'Permissões';
const G = { categoria: C, groupOnly: true, level: 'admin', nuncaLiberar: true };

module.exports = [
  {
    ...G, name: 'liberartodos', reaction: '🔓', descricao: 'Modo livre: membros usam comandos de administração (excepto os sensíveis)',
    async run(ctx) { ctx.perms.setModoLivre(ctx.jid, true); await ctx.reply('🔓 Modo livre ACTIVADO. Os membros podem usar comandos de administração, excepto os de gestão, configuração e proprietário.'); },
  },
  {
    ...G, name: 'bloqueartodos', reaction: '🔒', descricao: 'Desactiva o modo livre e remove todas as liberações',
    async run(ctx) { ctx.perms.resetGrupo(ctx.jid); await ctx.reply('🔒 Modo livre DESACTIVADO e liberações individuais removidas.'); },
  },
  {
    ...G, name: 'modolivre', reaction: '🔓', descricao: 'Liga/desliga o modo livre',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      const a = (ctx.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(a)) return ctx.reply(`Modo livre: ${cfg.modoLivre ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\nUso: .modolivre on/off`);
      ctx.perms.setModoLivre(ctx.jid, a === 'on');
      await ctx.reply(`Modo livre: ${a === 'on' ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}`);
    },
  },
  {
    ...G, name: 'liberar', reaction: '🔓', descricao: 'Define quem pode usar um comando (ex.: .liberar ban)',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      const nome = (ctx.args[0] || '').replace(/^\./, '').toLowerCase();
      if (!nome) {
        const l = Object.entries(cfg.liberados);
        return ctx.reply(l.length ? '🔓 Comandos liberados:\n' + l.map(([c, n]) => `• .${c} → ${n}`).join('\n') : '🔓 Nenhum comando liberado individualmente.\nUso: .liberar <comando> [membro|cliente|admin]  ·  .liberar <comando> off');
      }
      const cmd = ctx.registry.commands.map.get(nome);
      if (!cmd) throw userError('Esse comando não existe.');
      if (cmd.level === 'dono' || cmd.nuncaLiberar) throw userError('Esse comando não pode ser liberado.');
      const nivel = (ctx.args[1] || 'membro').toLowerCase();
      if (nivel === 'off') { ctx.perms.removeLiberado(ctx.jid, cmd.name); return ctx.reply(`🔒 .${cmd.name} voltou ao nível original (${cmd.level || 'membro'}).`); }
      if (!LEVELS[nivel] || nivel === 'dono') throw userError('Nível inválido. Usa: membro, cliente ou admin.');
      ctx.perms.setLiberado(ctx.jid, cmd.name, nivel);
      await ctx.reply(`🔓 .${cmd.name} liberado para: ${nivel}.${cmd.botAdmin && !ctx.botIsAdmin ? '\n⚠️ O bot precisa de ser administrador para este comando funcionar.' : ''}`);
    },
  },
  {
    ...G, name: 'clientes', reaction: '🤝', descricao: 'Gere os clientes do grupo',
    async run(ctx) {
      const a = (ctx.args[0] || '').toLowerCase();
      if (a === 'add' || a === 'del') {
        const ts = resolveTargets({ ...ctx, args: ctx.args.slice(1) });
        if (!ts.length) throw userError(`Uso: .clientes ${a} @user`);
        for (const j of ts) a === 'add' ? ctx.perms.addCliente(ctx.jid, jidToNumber(j)) : ctx.perms.removeCliente(ctx.jid, jidToNumber(j));
        return ctx.send({ text: `🤝 ${a === 'add' ? 'Adicionado(s)' : 'Removido(s)'}: ${ts.map(tag).join(' ')}`, mentions: ts });
      }
      const l = ctx.perms.listClientes(ctx.jid);
      await ctx.reply(l.length ? `🤝 Clientes (${l.length}):\n` + l.map((n) => '• +' + n).join('\n') + '\n\nUso: .clientes add @user  ·  .clientes del @user' : '🤝 Sem clientes registados.\nUso: .clientes add @user');
    },
  },
  {
    categoria: C, groupOnly: true, name: 'permissoes', reaction: '🔐', descricao: 'Mostra o teu nível e as permissões do grupo',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      const lib = Object.entries(cfg.liberados).map(([c, n]) => `.${c}→${n}`).join(' ') || 'nenhuma';
      await ctx.reply([
        '🔐 Permissões',
        `👤 O teu nível: ${ctx.level}`,
        `🔓 Modo livre: ${cfg.modoLivre ? 'activado' : 'desactivado'}`,
        `🤝 Clientes: ${ctx.perms.listClientes(ctx.jid).length}`,
        `📌 Liberações: ${lib}`,
        '',
        'Níveis: dono › administrador › cliente › membro',
      ].join('\n'));
    },
  },
];
