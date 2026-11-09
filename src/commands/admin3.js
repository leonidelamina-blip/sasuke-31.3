'use strict';
const { makeToggle } = require('../services/protecao');
const { resolverGrupo } = require('../utils/grupos');
const { userError } = require('../utils/format');

module.exports = [
  {
    name: 'addgp', category: 'GESTÃO DE GRUPOS', level: 'dono', nuncaLiberar: true, free: true, reaction: '✅',
    desc: 'Dono: autoriza um grupo (.addgp · .addgp <nº|ID> · .addgp remover [nº|ID] · .addgp lista)',
    async run(ctx) {
      const a = (ctx.args[0] || '').toLowerCase();
      const modo = ctx.config.soGruposAutorizados ? 'ACTIVADO (só grupos autorizados respondem)' : 'desactivado (config.json → soGruposAutorizados)';
      if (a === 'lista') {
        const l = Object.values(ctx.db.get('grupos').grupos).filter((g) => g.autorizado);
        return ctx.reply(l.length ? `✅ Grupos autorizados (${l.length}):\n` + l.map((g, i) => `${i + 1}. ${g.nome || g.id}`).join('\n') + `\n\nModo restrito: ${modo}` : `Nenhum grupo autorizado ainda.\nModo restrito: ${modo}`);
      }
      const remover = ['remover', 'del'].includes(a);
      const gid = await resolverGrupo(ctx, remover ? ctx.args[1] : ctx.args[0], { refresh: true });
      const rec = ctx.db.groupRecord(gid);
      if (remover) { rec.autorizado = false; delete rec.autorizadoEm; } else { rec.autorizado = true; rec.autorizadoEm = Date.now(); rec.autorizadoPor = ctx.number; }
      ctx.db.save('grupos');
      await ctx.reply(`${remover ? '🚫 Autorização removida' : '✅ Grupo autorizado'}: ${rec.nome || gid}\n🔒 Modo restrito: ${modo}`);
    },
  },
  {
    name: 'ban-senha', category: 'GESTÃO DE GRUPOS', groupOnly: true, level: 'admin', botAdmin: true, reaction: '🔐',
    desc: 'Admin: bane quem vazou a senha do grupo (fica na lista de banidos com o motivo)',
    async run(ctx) {
      const ban = ctx.registry.commands.map.get('ban');
      if (!ban) throw userError('Comando .ban indisponível.');
      ctx.motivoBan = 'vazou a senha do grupo';
      await ban.run(ctx);
    },
  },
  {
    name: 'rn', category: 'VENDAS & FINANCEIRO', groupOnly: false, free: true, reaction: '🔄',
    desc: 'Renovar aluguer: o dono renova (.rn <dias>); os outros veem como renovar',
    async run(ctx) {
      if (ctx.isOwner) {
        const alugar = ctx.registry.commands.map.get('alugar');
        return alugar.run(ctx);
      }
      if (!ctx.isGroup) throw userError('Usa este comando no grupo que queres renovar.');
      const i = ctx.rental.info(ctx.jid);
      await ctx.reply(`🔄 Renovar o aluguer deste grupo\n🩸 Estado: ${i.estado === 'ativo' ? `activo (${i.diasRestantes} dias)` : i.estado}\n\nPara renovar entra no canal:\n📢 ${ctx.config.canal.link}`);
    },
  },
  makeToggle({ name: 'anticoncorrencia', reaction: '🛡️', categoria: 'SEGURANÇA & MODERAÇÃO', descricao: 'Apaga anúncios de concorrentes (venda + contacto) de não-admins' }),
];
