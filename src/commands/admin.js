'use strict';
const { userError } = require('../utils/format');
const { formatDate } = require('../utils/helpers');

const C = 'Administração';
const G = { categoria: C, groupOnly: true, level: 'admin', botAdmin: true };

const defin = (name, reaction, descricao, modo, msg) => ({
  ...G, name, reaction, descricao,
  async run(ctx) {
    await ctx.admin((s) => s.groupSettingUpdate(ctx.jid, modo));
    ctx.session.groups.invalidate(ctx.jid);
    await ctx.reply(msg);
  },
});

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const horario = (name, campo, reaction, descricao, acao) => ({
  ...G, botAdmin: false, name, reaction, descricao,
  async run(ctx) {
    const h = ctx.db.groupConfig(ctx.jid).horario;
    const a = (ctx.args[0] || '').toLowerCase();
    if (!a) return ctx.reply(`🕒 ${acao} automático: ${h[campo] ? h[campo] + ' (todos os dias)' : 'desactivado'}\nUso: .${name} 22:00  ·  .${name} off`);
    if (a === 'off') { h[campo] = null; ctx.db.save('configuracoes'); return ctx.reply(`🕒 ${acao} automático desactivado.`); }
    const m = a.match(HHMM);
    if (!m) throw userError(`Hora inválida. Exemplo: .${name} 22:00`);
    h[campo] = `${m[1].padStart(2, '0')}:${m[2]}`;
    ctx.db.save('configuracoes');
    await ctx.reply(`🕒 O grupo será ${acao === 'Abertura' ? 'aberto' : 'fechado'} todos os dias às ${h[campo]} (${ctx.config.fusoHorario}).` + (ctx.botIsAdmin ? '' : '\n⚠️ Preciso de ser administrador para o fazer.'));
  },
});

module.exports = [
  defin('abrir', '🔓', 'Abre o grupo (todos escrevem)', 'not_announcement', '🔓 Grupo aberto. Todos podem enviar mensagens.'),
  defin('fechar', '🔒', 'Fecha o grupo (só admins escrevem)', 'announcement', '🔒 Grupo fechado. Só os administradores podem enviar mensagens.'),
  horario('abrirhorario', 'abrir', '🕒', 'Programa a abertura diária do grupo', 'Abertura'),
  horario('fecharhorario', 'fechar', '🕒', 'Programa o fecho diário do grupo', 'Fecho'),
  {
    ...G, name: 'nome', reaction: '📝', descricao: 'Altera o nome do grupo',
    async run(ctx) {
      if (!ctx.argText) throw userError('Uso: .nome Novo nome do grupo');
      if (ctx.argText.length > 100) throw userError('O nome pode ter no máximo 100 caracteres.');
      await ctx.admin((s) => s.groupUpdateSubject(ctx.jid, ctx.argText));
      ctx.session.groups.invalidate(ctx.jid);
      await ctx.reply('📝 Nome do grupo alterado.');
    },
  },
  {
    ...G, name: 'desc', reaction: '📄', descricao: 'Altera a descrição do grupo',
    async run(ctx) {
      if (!ctx.argText) throw userError('Uso: .desc Nova descrição');
      if (ctx.argText.length > 2048) throw userError('A descrição pode ter no máximo 2048 caracteres.');
      await ctx.admin((s) => s.groupUpdateDescription(ctx.jid, ctx.argText));
      ctx.session.groups.invalidate(ctx.jid);
      await ctx.reply('📄 Descrição alterada.');
    },
  },
  {
    ...G, name: 'link', reaction: '🔗', descricao: 'Mostra o link de convite do grupo',
    async run(ctx) {
      const code = await ctx.admin((s) => s.groupInviteCode(ctx.jid));
      await ctx.reply('🔗 https://chat.whatsapp.com/' + code);
    },
  },
  {
    ...G, name: 'novolink', reaction: '🔄', descricao: 'Revoga o link e cria um novo',
    async run(ctx) {
      const code = await ctx.admin((s) => s.groupRevokeInvite(ctx.jid));
      await ctx.reply('🔄 Link anterior revogado.\n🔗 https://chat.whatsapp.com/' + code);
    },
  },
  {
    categoria: C, groupOnly: true, name: 'infogp', reaction: 'ℹ️', descricao: 'Informações do grupo',
    async run(ctx) {
      const m = await ctx.refreshMeta();
      const adm = m.participants.filter((p) => p.admin).length;
      const al = ctx.rental.info(ctx.jid);
      const l = [
        `ℹ️ ${m.subject}`,
        `👥 Membros: ${m.participants.length} (👑 ${adm} admins)`,
        `📅 Criado em: ${m.creation ? formatDate(m.creation * 1000, ctx.config.fusoHorario) : 'desconhecido'}`,
        `💬 Mensagens: ${m.announce ? 'só administradores' : 'todos'}`,
        `⚙️ Editar informações: ${m.restrict ? 'só administradores' : 'todos'}`,
        `🩸 Aluguer: ${al.estado === 'ativo' ? `activo (${al.diasRestantes} dias)` : al.estado}`,
      ];
      if (m.desc) l.push('', '📄 ' + String(m.desc).slice(0, 500));
      await ctx.reply(l.join('\n'));
    },
  },
];
