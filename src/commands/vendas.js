'use strict';
const fs = require('fs');
const path = require('path');
const commerce = require('../services/commerce');
const store = require('../services/comprovativosStore');
const sms = require('../services/sms');
const { baixar } = require('../utils/media');
const { resolveTargets } = require('../utils/targets');
const { userError, tag, botNumbers } = require('../utils/format');
const { jidToNumber, formatDate } = require('../utils/helpers');
const log = require('../utils/logger');

const CAT = 'VENDAS & FINANCEIRO';
const A = { category: CAT, groupOnly: true, level: 'admin' };

const compras = (ctx) => commerce.compras(ctx.db, ctx.jid).registos;
const comprov = (ctx) => store.grupo(ctx.db, ctx.jid).registos;

/** Quem comprou: pedidos confirmados + comprovativos aprovados. */
function compradores(ctx) {
  const s = new Set();
  for (const r of compras(ctx)) if (r.estado === 'confirmado') s.add(r.numero);
  for (const r of comprov(ctx)) if (r.estado === 'aprovado') s.add(r.numero);
  return s;
}

function rankingPicos(ctx) {
  const c = {};
  for (const r of compras(ctx)) if (r.estado === 'confirmado') c[r.numero] = (c[r.numero] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10);
}
const medalhas = ['🥇', '🥈', '🥉'];
const textoPicos = (top) => '🏆 PICOS — quem mais comprou\n\n' + top.map(([n, v], i) => `${medalhas[i] || `${i + 1}.`} @${n} — ${v} compra(s)`).join('\n');

const parseSaldo = (ctx) => {
  const args = ctx.args.filter((a) => !a.startsWith('@'));
  const val = args.find((a) => /^-?\d{1,8}([.,]\d{1,2})?$/.test(a));
  const unidade = (args[args.indexOf(val) + 1] || '').match(/^[A-Za-z]{1,6}$/) ? args[args.indexOf(val) + 1].toUpperCase() : 'MT';
  return { valor: val === undefined ? null : Number(val.replace(',', '.')), unidade };
};
const linhasSaldo = (s) => Object.entries(s || {}).filter(([, v]) => v > 0).map(([u, v]) => `${v} ${u}`).join(' · ');

module.exports = [
  {
    name: 'depositar', category: CAT, groupOnly: true, reaction: '💳', desc: 'Diz que já depositaste: regista PENDENTE e avisa os admins (ex.: .depositar 100Mb)',
    async run(ctx) {
      if (ctx.db.groupConfig(ctx.jid).comprasAtivas === false) throw userError('Os pedidos estão desactivados neste grupo.');
      const desc = ctx.argText.trim();
      if (!desc) throw userError('Uso: .depositar <o que compraste>   Exemplo: .depositar 100Mb\n(junta a foto do comprovativo, se tiveres)');
      if (desc.length > 120) throw userError('Máximo de 120 caracteres.');
      if (store.pendentes(ctx.db, ctx.jid).filter((r) => r.numero === ctx.number).length >= 3) throw userError('Já tens 3 comprovativos pendentes. Espera a aprovação.');
      const r = store.criar(ctx.db, ctx.jid, { tipo: 'deposito', operadora: 'outra', valor: null, descricao: desc, referencia: 'TMP', numero: ctx.number, nome: ctx.pushName || null, origem: 'depositar' });
      r.referencia = 'DEP' + r.id;
      const foto = await baixar(ctx, ['imageMessage']);
      if (foto) { try { r.foto = store.guardarFoto(ctx.jid, r.id, foto.buf); } catch (e) { log.warn('Foto não guardada: ' + e.message); } }
      ctx.db.save('comprovativos');
      const m = await ctx.refreshMeta().catch(() => null);
      const admins = (m?.participants || ctx.meta?.participants || []).filter((p) => p.admin).map((p) => p.id).slice(0, 8);
      await ctx.send({
        text: `💳 Depósito #${r.id} registado: ⏳ PENDENTE\n📦 ${desc}${r.foto ? '\n🖼️ Foto guardada' : ''}\n\n👑 Admins: ${admins.map(tag).join(' ')}\n➡️ .comprovativo aprovar ${r.id}  ·  .comprovativo recusar ${r.id}`,
        mentions: [ctx.sender, ...admins],
      });
    },
  },
  {
    name: 'picos', category: CAT, groupOnly: true, reaction: '🏆', desc: 'Ranking de quem mais comprou (compras confirmadas do grupo)',
    async run(ctx) {
      const top = rankingPicos(ctx);
      if (!top.length) return ctx.reply('Ninguém comprou ainda');
      await ctx.send({ text: textoPicos(top), mentions: top.map(([n]) => n + '@s.whatsapp.net') });
    },
  },
  {
    ...A, name: 'picospv', reaction: '📬', desc: 'Envia-te o ranking de picos no privado',
    async run(ctx) {
      const top = rankingPicos(ctx);
      const texto = top.length ? textoPicos(top).replace(/@(\d+)/g, '+$1') : 'Ninguém comprou ainda';
      await ctx.scheduler.send(ctx.sender, { text: texto + `\n\n(grupo: ${ctx.meta?.subject || ctx.jid})` });
      await ctx.reply('📬 Enviei o ranking no teu privado.');
    },
  },
  {
    name: 'rec', category: 'OUTROS • MEMBROS', groupOnly: true, reaction: '🧾', desc: 'Mostra o teu último comprovativo/recibo neste grupo',
    async run(ctx) {
      const meus = comprov(ctx).filter((r) => r.numero === ctx.number);
      const r = meus[meus.length - 1];
      if (!r) {
        const p = compras(ctx).filter((x) => x.numero === ctx.number).pop();
        if (p) return ctx.reply(`🧾 Último pedido: #${p.id} — ${p.texto}\nEstado: ${p.estado}\nAinda não tens comprovativo registado.`);
        return ctx.reply('🧾 Ainda não tens comprovativos neste grupo.');
      }
      const quanto = r.valor === null || r.valor === undefined ? (r.descricao || 'depósito') : sms.fmtValor(r.valor);
      const estado = { pendente: '⏳ pendente', aprovado: '✅ aprovado', recusado: '❌ recusado' }[r.estado] || r.estado;
      const cap = [`🧾 RECIBO #${r.id}`, `📦 ${quanto}`, `🔑 Ref: ${r.referencia}`, `📌 Estado: ${estado}`, `🕒 ${formatDate(r.em, ctx.config.fusoHorario)}`, r.motivo ? `📝 ${r.motivo}` : null].filter(Boolean).join('\n');
      let foto = null;
      try { if (r.foto) foto = fs.readFileSync(path.join(process.cwd(), r.foto)); } catch { /* sem foto */ }
      await ctx.send(foto ? { image: foto, caption: cap } : { text: cap });
    },
  },
  {
    ...A, name: 'chave', reaction: '🔑', desc: 'Admin: mostra os dados de pagamento configurados neste grupo',
    async run(ctx) {
      const d = commerce.dados(ctx.db, ctx.jid);
      const linhas = [];
      if (d.pagamento?.texto) linhas.push(d.pagamento.texto);
      if (d.mpesa.length) linhas.push('📱 M-Pesa:\n' + d.mpesa.map((x) => `• ${x.numero}${x.nome ? ' — ' + x.nome : ''}`).join('\n'));
      if (d.emola.length) linhas.push('📱 e-Mola:\n' + d.emola.map((x) => `• ${x.numero}${x.nome ? ' — ' + x.nome : ''}`).join('\n'));
      if (!linhas.length) throw userError('Este grupo ainda não configurou pagamento. Usa .setpagamento, .addmpesa e .addemola para configurar.');
      await ctx.reply('🔑 CHAVE DE PAGAMENTO\n\n' + linhas.join('\n\n'));
    },
  },
  {
    ...A, name: 'semcompra', reaction: '🛍️', desc: 'Lista os membros que ainda não compraram nada',
    async run(ctx) {
      const m = await ctx.refreshMeta();
      const bots = botNumbers(ctx); const ja = compradores(ctx);
      const l = m.participants.filter((p) => !p.admin).map((p) => jidToNumber(p.phoneNumber || p.id)).filter((n) => !bots.includes(n) && !ja.has(n));
      await ctx.reply(l.length ? `🛍️ Sem compras (${l.length}):\n` + l.slice(0, 50).map((n) => '• +' + n).join('\n') + (l.length > 50 ? `\n…e mais ${l.length - 50}` : '') : '🛍️ Todos os membros já compraram.');
    },
  },
  {
    ...A, name: 'faltacompra', reaction: '⏳', desc: 'Lista quem tem pedidos/comprovativos pendentes (falta concluir a compra)',
    async run(ctx) {
      const p = {};
      for (const r of compras(ctx)) if (r.estado === 'pendente') (p[r.numero] ||= []).push(`pedido #${r.id}`);
      for (const r of comprov(ctx)) if (r.estado === 'pendente') (p[r.numero] ||= []).push(`comprovativo #${r.id}`);
      const e = Object.entries(p);
      if (!e.length) return ctx.reply('⏳ Ninguém com compras por concluir.');
      await ctx.send({ text: `⏳ Por concluir (${e.length}):\n` + e.slice(0, 30).map(([n, l]) => `@${n}: ${l.join(', ')}`).join('\n'), mentions: e.slice(0, 30).map(([n]) => n + '@s.whatsapp.net') });
    },
  },
  {
    ...A, name: 'addsaldo', reaction: '➕', desc: 'Admin: adiciona saldo/megas à carteira de um cliente (.addsaldo @pessoa 100 [unidade])',
    async run(ctx) {
      const alvo = resolveTargets({ ...ctx, args: ctx.args.filter((a) => !/^-?\d{1,8}([.,]\d{1,2})?$/.test(a)) })[0];
      const { valor, unidade } = parseSaldo(ctx);
      if (!alvo || valor === null || valor === 0) throw userError('Uso: .addsaldo @pessoa 100   ou   .addsaldo @pessoa 500 MB');
      const d = commerce.dados(ctx.db, ctx.jid);
      const n = jidToNumber(alvo);
      const c = d.saldos[n] || (d.saldos[n] = { saldo: {}, historico: [] });
      const novo = Math.round(((c.saldo[unidade] || 0) + valor) * 100) / 100;
      if (novo < 0) throw userError(`Saldo insuficiente: ${c.saldo[unidade] || 0} ${unidade}.`);
      c.saldo[unidade] = novo;
      c.historico.push({ valor, unidade, por: ctx.number, em: Date.now() });
      if (c.historico.length > 30) c.historico.shift();
      ctx.db.save('pagamentos');
      await ctx.send({ text: `➕ ${valor > 0 ? 'Adicionado' : 'Removido'} ${Math.abs(valor)} ${unidade} a ${tag(alvo)}.\n💎 Saldo: ${linhasSaldo(c.saldo) || '0'}\nℹ️ Registo interno do grupo (não é pagamento real).`, mentions: [alvo] });
    },
  },
  {
    ...A, name: 'restanas', reaction: '📋', desc: 'Lista os clientes com saldo/megas restantes',
    async run(ctx) {
      const e = Object.entries(commerce.dados(ctx.db, ctx.jid).saldos).filter(([, c]) => linhasSaldo(c.saldo));
      if (!e.length) return ctx.reply('📋 Ninguém tem saldo restante neste grupo.');
      await ctx.send({ text: `📋 Saldos restantes (${e.length}):\n` + e.slice(0, 40).map(([n, c]) => `@${n}: ${linhasSaldo(c.saldo)}`).join('\n'), mentions: e.slice(0, 40).map(([n]) => n + '@s.whatsapp.net') });
    },
  },
  {
    ...A, name: 'limparrestanas', nuncaLiberar: true, reaction: '🧹', desc: 'Zera os saldos de todos os clientes do grupo (precisa de "confirmar")',
    async run(ctx) {
      const d = commerce.dados(ctx.db, ctx.jid);
      const n = Object.keys(d.saldos).length;
      if ((ctx.args[0] || '').toLowerCase() !== 'confirmar') return ctx.reply(`🧹 Isto zera os saldos de ${n} cliente(s).\nConfirma com: .limparrestanas confirmar`);
      d.saldos = {}; ctx.db.save('pagamentos');
      await ctx.reply(`🧹 Saldos de ${n} cliente(s) apagados.`);
    },
  },
];
