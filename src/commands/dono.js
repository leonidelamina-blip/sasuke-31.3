'use strict';
const textos = require('../utils/textos');
const { conhecidos, resolverGrupo, sessaoDe } = require('../utils/grupos');
const { userError } = require('../utils/format');
const { parseDays } = require('../utils/helpers');

const D = { category: 'VENDAS & FINANCEIRO', level: 'dono', nuncaLiberar: true, free: true };
const nomeGrupo = (ctx, gid) => ctx.db.groupRecord(gid).nome || gid;

async function avisar(ctx, gid, texto) {
  if (gid === ctx.jid) return ctx.send({ text: texto });
  await sessaoDe(ctx, gid).scheduler.send(gid, { text: texto });
  return null;
}

module.exports = [
  {
    ...D, name: 'alugar', reaction: '👑', descricao: 'Activa ou renova o aluguer de um grupo',
    async run(ctx) {
      const dias = parseDays(ctx.args[0]);
      if (!dias) throw userError('Uso: .alugar <dias> [nº da lista .alugueis | ID do grupo]\nDentro do grupo basta .alugar 30');
      const gid = await resolverGrupo(ctx, ctx.args[1], { refresh: true });
      const r = ctx.rental.alugar(gid, dias, ctx.number, ctx.db.groupRecord(gid).nome);
      ctx.session.groups.invalidate(gid);
      let aviso = '';
      try { await avisar(ctx, gid, textos.aluguelAtivo(dias)); } catch (e) { aviso = `\n⚠️ Aluguer registado, mas não consegui avisar o grupo: ${e.message}`; }
      if (gid !== ctx.jid) await ctx.reply(`✅ ${r.acao === 'alugar' ? 'Alugado' : 'Renovado'}: ${nomeGrupo(ctx, gid)}\n⏳ Restam ${r.diasRestantes} dias.${aviso}`);
      else if (r.acao === 'renovar') await ctx.reply(`⏳ Total de dias restantes: ${r.diasRestantes}.`);
    },
  },
  {
    ...D, name: 'tirardias', reaction: '➖', descricao: 'Remove dias de um aluguer',
    async run(ctx) {
      const dias = parseDays(ctx.args[0]);
      if (!dias) throw userError('Uso: .tirardias <dias> [nº da lista | ID do grupo]');
      const gid = await resolverGrupo(ctx, ctx.args[1]);
      const r = ctx.rental.tirarDias(gid, dias, ctx.number);
      await ctx.reply(`➖ ${dias} dia(s) removido(s) de ${nomeGrupo(ctx, gid)}.\n` + (r.expirou ? '🥀 O aluguer expirou (o grupo será avisado).' : `⏳ Restam ${r.diasRestantes} dias.`));
    },
  },
  {
    ...D, name: 'anular', reaction: '🚫', descricao: 'Cancela o aluguer de um grupo',
    async run(ctx) {
      const gid = await resolverGrupo(ctx, ctx.args[0]);
      ctx.rental.anular(gid, ctx.number);
      let aviso = '';
      try { await avisar(ctx, gid, textos.aluguelAnulado(ctx.config)); } catch (e) { aviso = `\n⚠️ Não consegui avisar o grupo: ${e.message}`; }
      if (gid !== ctx.jid) await ctx.reply(`🚫 Aluguer anulado: ${nomeGrupo(ctx, gid)}.${aviso}`);
    },
  },
  {
    ...D, name: 'alugueis', reaction: '📜', descricao: 'Lista os grupos e o estado dos alugueres',
    async run(ctx) {
      const lista = await conhecidos(ctx, { refresh: true });
      if (!lista.length) return ctx.reply('📜 Ainda não conheço nenhum grupo.');
      const filtro = (ctx.args[0] || '').toLowerCase();
      const linhas = [];
      let ativos = 0;
      lista.forEach((g, i) => {
        const inf = ctx.rental.info(g.gid);
        if (inf.estado === 'ativo') ativos++;
        const est = inf.estado === 'ativo' ? `✅ ${inf.diasRestantes}d` : inf.estado === 'nenhum' ? '➖ sem aluguer' : `❌ ${inf.estado}`;
        if (filtro === 'ativos' && inf.estado !== 'ativo') return;
        if (filtro === 'expirados' && !['expirado', 'cancelado'].includes(inf.estado)) return;
        linhas.push(`${i + 1}. ${g.nome || g.gid}${g.bloqueado ? ' 🔒' : ''} — ${est}`);
      });
      await ctx.reply(`📜 Grupos (${lista.length}) · ✅ activos: ${ativos}\n\n${linhas.slice(0, 80).join('\n') || 'Nada a mostrar.'}${linhas.length > 80 ? `\n…e mais ${linhas.length - 80}` : ''}\n\nUsa o número da lista: .alugar 30 3`);
    },
  },
  {
    ...D, name: 'bangp', reaction: '⛔', descricao: 'Bloqueia/desbloqueia um grupo (o bot ignora-o)',
    async run(ctx) {
      const sair = ctx.args.includes('sair');
      const token = ctx.args.find((a) => a !== 'sair');
      const gid = await resolverGrupo(ctx, token, { refresh: true });
      const rec = ctx.db.groupRecord(gid);
      rec.bloqueado = !rec.bloqueado;
      ctx.db.save('grupos');
      let extra = '';
      if (rec.bloqueado && sair) {
        try { await sessaoDe(ctx, gid).scheduler.run(gid, (s) => s.groupLeave(gid)); extra = '\n👋 O bot saiu do grupo.'; } catch (e) { extra = `\n⚠️ Não consegui sair: ${e.message}`; }
      }
      await ctx.reply(`${rec.bloqueado ? '⛔ Grupo BLOQUEADO' : '✅ Grupo DESBLOQUEADO'}: ${rec.nome || gid}${extra}${rec.bloqueado && !sair ? '\nℹ️ Usa ".bangp sair" para o bot também sair do grupo.' : ''}`);
    },
  },
];
