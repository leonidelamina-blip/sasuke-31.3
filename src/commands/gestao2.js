'use strict';
const store = require('../services/comprovativosStore');
const commerce = require('../services/commerce');
const { warnings } = require('../services/protecao');
const { normNum } = require('../utils/targets');
const { userError, onOff, botNumbers, tag } = require('../utils/format');
const { jidToNumber, DAY } = require('../utils/helpers');
const sms = require('../services/sms');

const G = { groupOnly: true, level: 'admin' };
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Membros sem actividade registada (só se o bot já observa o grupo há tempo suficiente). */
async function fantasmas(ctx) {
  const m = await ctx.refreshMeta();
  const dias = ctx.db.groupConfig(ctx.jid).inatividadeDias;
  const desde = ctx.db.groupRecord(ctx.jid).primeiraVez || Date.now();
  const observado = Math.floor((Date.now() - desde) / DAY);
  const act = ctx.db.get('ranking').grupos[ctx.jid] || {};
  const bots = botNumbers(ctx);
  const lista = m.participants.filter((p) => {
    if (p.admin) return false;
    const n = jidToNumber(p.phoneNumber || p.id);
    if (bots.includes(n) || bots.includes(jidToNumber(p.id)) || ctx.perms.isOwner([n, jidToNumber(p.id)])) return false;
    const u = act[n] || act[jidToNumber(p.id)];
    return !u || !u.ultima || Date.now() - u.ultima > dias * DAY;
  }).map((p) => p.id);
  return { lista, dias, observado };
}

module.exports = [
  {
    ...G, name: 'grupo', desc: 'Abre/fecha o grupo ou mostra o estado (.grupo abrir|fechar|info)', category: 'GESTÃO DE GRUPOS', reaction: '👥',
    async run(ctx) {
      const a = (ctx.args[0] || 'info').toLowerCase();
      const m = await ctx.refreshMeta();
      if (a === 'info') return ctx.reply(`👥 ${m.subject}\n💬 Mensagens: ${m.announce ? 'só administradores (fechado)' : 'todos (aberto)'}\n👤 Membros: ${m.participants.length}\n\nUso: .grupo abrir  ·  .grupo fechar`);
      if (!['abrir', 'fechar'].includes(a)) throw userError('Uso: .grupo abrir  ·  .grupo fechar  ·  .grupo info');
      if (!ctx.botIsAdmin) throw userError('Preciso de ser administrador do grupo para executar este comando.');
      await ctx.admin((s) => s.groupSettingUpdate(ctx.jid, a === 'abrir' ? 'not_announcement' : 'announcement'));
      ctx.session.groups.invalidate(ctx.jid);
      await ctx.reply(a === 'abrir' ? '🔓 Grupo aberto.' : '🔒 Grupo fechado.');
    },
  },
  {
    ...G, name: 'periodoremocao', desc: 'Define quantos dias sem actividade tornam alguém "fantasma"', category: 'SEGURANÇA & MODERAÇÃO', reaction: '⏳',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      if (!ctx.args[0]) return ctx.reply(`⏳ Período de inactividade: ${cfg.inatividadeDias} dias\nUso: .periodoremocao 30 (7 a 365)`);
      const n = Number(ctx.args[0]);
      if (!Number.isInteger(n) || n < 7 || n > 365) throw userError('Escolhe um número de dias entre 7 e 365.');
      cfg.inatividadeDias = n; ctx.db.save('configuracoes');
      await ctx.reply(`⏳ Período de inactividade definido para ${n} dias.`);
    },
  },
  {
    ...G, name: 'statusremocao', desc: 'Mostra quantos fantasmas o bot encontrou', category: 'SEGURANÇA & MODERAÇÃO', reaction: '📊',
    async run(ctx) {
      const f = await fantasmas(ctx);
      await ctx.reply(`📊 Remoção de fantasmas\n⏳ Período: ${f.dias} dias\n👁️ O bot observa este grupo há ${f.observado} dias\n👻 Candidatos: ${f.lista.length}\n\n${f.observado < f.dias ? `⚠️ Ainda não tenho dados suficientes (preciso de ${f.dias} dias). Não removo ninguém até lá.` : 'Usa .remover5 para ver e .remover5 confirmar para remover até 5.'}`);
    },
  },
  {
    ...G, botAdmin: true, name: 'remover5', desc: 'Remove até 5 fantasmas (mostra primeiro; precisa de "confirmar")', category: 'SEGURANÇA & MODERAÇÃO', reaction: '🧹', nuncaLiberar: true,
    async run(ctx) {
      const f = await fantasmas(ctx);
      if (f.observado < f.dias) throw userError(`Só observo este grupo há ${f.observado} dias (período: ${f.dias}). Não removo ninguém com dados incompletos.`);
      const alvo = f.lista.slice(0, 5);
      if (!alvo.length) return ctx.reply('👻 Não encontrei fantasmas.');
      if ((ctx.args[0] || '').toLowerCase() !== 'confirmar') {
        return ctx.send({ text: `👻 Seriam removidos (${alvo.length} de ${f.lista.length}):\n${alvo.map(tag).join('\n')}\n\nConfirma com: .remover5 confirmar`, mentions: alvo });
      }
      let ok = 0;
      for (const j of alvo) {
        try {
          await ctx.admin((s) => s.groupParticipantsUpdate(ctx.jid, [j], 'remove'));
          warnings(ctx.db).ocorrencia(ctx.jid, jidToNumber(j), `inactivo há mais de ${f.dias} dias`, 'remocao'); ok++;
        } catch { /* continua */ }
      }
      await ctx.reply(`🧹 ${ok}/${alvo.length} fantasmas removidos.`);
    },
  },
  {
    ...G, name: 'agendar', desc: 'Agenda uma mensagem diária (ou única) para uma hora', category: 'AUTOMAÇÕES', reaction: '⏰',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      const a = (ctx.args[0] || '').toLowerCase();
      if (!a) {
        return ctx.reply(cfg.agenda.length
          ? '⏰ Agenda do grupo:\n' + cfg.agenda.map((x, i) => `${i + 1}. ${x.hhmm} ${x.repetir ? '(todos os dias)' : '(uma vez)'} — ${x.texto.slice(0, 60)}`).join('\n') + '\n\n.agendar del <nº>  ·  .agendar limpar'
          : `⏰ Sem mensagens agendadas.\nUso: .agendar 08:00 Bom dia a todos\n.agendar 08:00 uma Mensagem só uma vez\nFuso: ${ctx.config.fusoHorario}`);
      }
      if (a === 'limpar') { cfg.agenda = []; ctx.db.save('configuracoes'); return ctx.reply('⏰ Agenda limpa.'); }
      if (a === 'del') {
        const i = Number(ctx.args[1]) - 1;
        if (!cfg.agenda[i]) throw userError('Número inexistente. Vê a lista com .agendar');
        const [r] = cfg.agenda.splice(i, 1); ctx.db.save('configuracoes');
        return ctx.reply(`⏰ Removido: ${r.hhmm} — ${r.texto.slice(0, 40)}`);
      }
      const m = a.match(HHMM);
      if (!m) throw userError('Hora inválida. Exemplo: .agendar 08:00 Bom dia');
      const uma = (ctx.args[1] || '').toLowerCase() === 'uma';
      const texto = ctx.args.slice(uma ? 2 : 1).join(' ').trim();
      if (!texto) throw userError('Escreve a mensagem depois da hora.');
      if (texto.length > 1000) throw userError('Máximo de 1000 caracteres.');
      if (cfg.agenda.length >= 10) throw userError('Máximo de 10 mensagens agendadas por grupo.');
      const hhmm = `${m[1].padStart(2, '0')}:${m[2]}`;
      cfg.agenda.push({ id: Date.now(), hhmm, texto, repetir: !uma, ultimo: null, por: ctx.number, em: Date.now() });
      ctx.db.save('configuracoes');
      await ctx.reply(`⏰ Agendado: ${hhmm} ${uma ? '(uma vez)' : '(todos os dias)'} — fuso ${ctx.config.fusoHorario}.`);
    },
  },
  {
    ...G, name: 'relatorio', desc: 'Resumo do grupo: membros, comprovativos, pedidos e aluguer', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '📈',
    async run(ctx) {
      const m = await ctx.refreshMeta();
      const c = store.grupo(ctx.db, ctx.jid).registos;
      const por = (e) => c.filter((r) => r.estado === e);
      const soma = por('aprovado').reduce((t, r) => t + (r.valor || 0), 0);
      const ped = commerce.compras(ctx.db, ctx.jid).registos;
      const al = ctx.rental.info(ctx.jid);
      const top = Object.entries(ctx.db.get('ranking').grupos[ctx.jid] || {}).sort((a, b) => b[1].msgs - a[1].msgs).slice(0, 3);
      await ctx.send({
        text: [
          `📈 RELATÓRIO — ${m.subject}`, `👤 Membros: ${m.participants.length} (👑 ${m.participants.filter((p) => p.admin).length})`,
          `🧾 Comprovativos: ⏳ ${por('pendente').length} · ✅ ${por('aprovado').length} · ❌ ${por('recusado').length}`,
          `💰 Total aprovado: ${sms.fmtValor(soma)}`, `🛒 Pedidos: ${ped.length} (⏳ ${ped.filter((p) => p.estado === 'pendente').length})`,
          `🩸 Aluguer: ${al.estado === 'ativo' ? `activo (${al.diasRestantes} dias)` : al.estado}`,
          top.length ? '🏅 Mais activos: ' + top.map(([n, v]) => `@${n} (${v.msgs})`).join(' · ') : null,
        ].filter(Boolean).join('\n'),
        mentions: top.map(([n]) => n + '@s.whatsapp.net'),
      });
    },
  },
  {
    ...G, name: 'anularcompra', desc: 'Anula um pedido de compra (.anularcompra ID)', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '🚫',
    async run(ctx) {
      const r = commerce.compras(ctx.db, ctx.jid).registos.find((x) => x.id === Number(ctx.args[0]));
      if (!r) throw userError('Uso: .anularcompra <nº do pedido>');
      if (r.estado === 'anulado') throw userError('Esse pedido já foi anulado.');
      r.estado = 'anulado'; r.validadoPor = ctx.number; r.validadoEm = Date.now(); ctx.db.save('compras');
      await ctx.reply(`🚫 Pedido #${r.id} anulado.`);
    },
  },
  {
    ...G, name: 'ativarcompras', desc: 'Liga/desliga os pedidos de compra do grupo', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '🛒',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      const st = onOff(ctx.args[0]);
      if (st === null) return ctx.reply(`🛒 Compras: ${cfg.comprasAtivas ? 'ACTIVADAS ✅' : 'DESACTIVADAS ❌'}\nUso: .ativarcompras on/off`);
      cfg.comprasAtivas = st; ctx.db.save('configuracoes');
      await ctx.reply(`🛒 Compras: ${st ? 'ACTIVADAS ✅' : 'DESACTIVADAS ❌'}`);
    },
  },
  {
    ...G, name: 'limparcompras', desc: 'Apaga os pedidos de compra do grupo (precisa de "confirmar")', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '🧹', nuncaLiberar: true,
    async run(ctx) {
      const reg = commerce.compras(ctx.db, ctx.jid);
      if ((ctx.args[0] || '').toLowerCase() !== 'confirmar') return ctx.reply(`🧹 Isto apaga ${reg.registos.length} pedido(s) deste grupo.\nConfirma com: .limparcompras confirmar`);
      const n = reg.registos.length; reg.registos = []; ctx.db.save('compras');
      await ctx.reply(`🧹 ${n} pedido(s) apagado(s).`);
    },
  },
  {
    ...G, name: 'addtelefone', desc: 'Guarda um telefone na lista do grupo', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '📞',
    async run(ctx) {
      const n = normNum(ctx.args[0]);
      if (!n) throw userError('Uso: .addtelefone <número> [nome]');
      const cfg = ctx.db.groupConfig(ctx.jid);
      if (cfg.telefones.some((t) => t.numero === n)) throw userError('Esse número já está na lista.');
      if (cfg.telefones.length >= 50) throw userError('Máximo de 50 telefones por grupo.');
      cfg.telefones.push({ numero: n, nome: ctx.args.slice(1).join(' ').slice(0, 40) || null, em: Date.now() });
      ctx.db.save('configuracoes');
      await ctx.reply(`📞 +${n} guardado (${cfg.telefones.length}/50).`);
    },
  },
  {
    ...G, name: 'deltelefone', desc: 'Remove um telefone da lista (número ou nº da lista)', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '🗑️',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      const k = ctx.args[0];
      if (!k) throw userError('Uso: .deltelefone <número ou nº da lista>');
      const i = /^\d{1,3}$/.test(k) ? Number(k) - 1 : cfg.telefones.findIndex((t) => t.numero === normNum(k));
      if (i < 0 || !cfg.telefones[i]) throw userError('Telefone não encontrado. Vê a lista com .listtelefones');
      const [r] = cfg.telefones.splice(i, 1); ctx.db.save('configuracoes');
      await ctx.reply(`🗑️ +${r.numero} removido.`);
    },
  },
  {
    ...G, level: 'membro', name: 'listtelefones', desc: 'Lista os telefones guardados do grupo', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '📞',
    async run(ctx) {
      const t = ctx.db.groupConfig(ctx.jid).telefones;
      await ctx.reply(t.length ? `📞 Telefones (${t.length}):\n` + t.map((x, i) => `${i + 1}. +${x.numero}${x.nome ? ' — ' + x.nome : ''}`).join('\n') : '📞 Ainda não há telefones guardados.\nAdmin usa .addtelefone <número> [nome]');
    },
  },
];
