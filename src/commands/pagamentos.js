'use strict';
const commerce = require('../services/commerce');
const { makeToggle } = require('../services/protecao');
const { normNum } = require('../utils/targets');
const { userError, quotedText, tag } = require('../utils/format');


const C = 'Pagamentos';
const G = { categoria: C, groupOnly: true };

// Consulta simples de um campo configurado pelo grupo
const ver = (name, campo, reaction, descricao, titulo) => ({
  ...G, name, reaction, descricao,
  async run(ctx) {
    const t = commerce.getCampo(ctx.db, ctx.jid, campo);
    await ctx.reply(t ? `${titulo}\n\n${t}` : commerce.VAZIO);
  },
});

const linhasNumeros = (d) => {
  const l = [];
  if (d.mpesa.length) l.push('📱 M-Pesa:\n' + d.mpesa.map((x) => `• ${x.numero}${x.nome ? ' — ' + x.nome : ''}`).join('\n'));
  if (d.emola.length) l.push('📱 e-Mola:\n' + d.emola.map((x) => `• ${x.numero}${x.nome ? ' — ' + x.nome : ''}`).join('\n'));
  return l.join('\n\n');
};

// M-Pesa (Vodacom): 84/85 · e-Mola (Movitel): 86/87
const carteira = (tipo, prefixos, reaction) => ({
  ...G, level: 'admin', nuncaLiberar: true, name: tipo === 'mpesa' ? 'addmpesa' : 'addemola', reaction,
  descricao: `Regista um número ${tipo === 'mpesa' ? 'M-Pesa' : 'e-Mola'} do grupo`,
  async run(ctx) {
    const d = commerce.dados(ctx.db, ctx.jid);
    const lista = d[tipo];
    const a = (ctx.args[0] || '').toLowerCase();
    if (!a) return ctx.reply(lista.length ? `${tipo === 'mpesa' ? 'M-Pesa' : 'e-Mola'} do grupo:\n` + lista.map((x) => `• ${x.numero}${x.nome ? ' — ' + x.nome : ''}`).join('\n') + `\n\nUso: .${ctx.command.name} 8xxxxxxxx Nome  ·  .${ctx.command.name} remover 8xxxxxxxx` : `Uso: .${ctx.command.name} 8xxxxxxxx Nome do titular`);
    const remover = ['remover', 'del', 'apagar'].includes(a);
    const num = normNum(ctx.args[remover ? 1 : 0]);
    const local = num && num.startsWith('258') ? num.slice(3) : null;
    if (!local || !prefixos.includes(local.slice(0, 2))) throw userError(`Número inválido. ${tipo === 'mpesa' ? 'M-Pesa' : 'e-Mola'} usa números ${prefixos.join(' ou ')}xxxxxxx.`);
    if (remover) {
      const i = lista.findIndex((x) => x.numero === local);
      if (i < 0) throw userError('Esse número não está registado.');
      lista.splice(i, 1); ctx.db.save('pagamentos');
      return ctx.reply(`🗑️ ${local} removido.`);
    }
    if (lista.some((x) => x.numero === local)) throw userError('Esse número já está registado.');
    if (lista.length >= 5) throw userError('Máximo de 5 números por serviço.');
    lista.push({ numero: local, nome: ctx.args.slice(1).join(' ').slice(0, 40) || null, por: ctx.number, em: Date.now() });
    ctx.db.save('pagamentos');
    await ctx.reply(`✅ ${local} registado como ${tipo === 'mpesa' ? 'M-Pesa' : 'e-Mola'}.`);
  },
});

const estadoTxt = { pendente: '⏳ pendente', confirmado: '✅ confirmado', recusado: '❌ recusado' };

module.exports = [
  {
    ...G, name: 'compra', reaction: '🧾', descricao: 'Informações de compra e registo de pedidos',
    async run(ctx) {
      const a = (ctx.args[0] || '').toLowerCase();
      const reg = commerce.compras(ctx.db, ctx.jid);
      const admin = ctx.isAdmin || ctx.isOwner;
      if (!a) {
        const t = commerce.getCampo(ctx.db, ctx.jid, 'compra');
        return ctx.reply((t ? `🧾 Como comprar\n\n${t}` : commerce.VAZIO) + '\n\nPara registar um pedido: .compra pedir <o que queres>');
      }
      if (a === 'pedir') {
        if (ctx.db.groupConfig(ctx.jid).comprasAtivas === false) throw userError('Os pedidos de compra estão desactivados neste grupo.');
        const texto = ctx.args.slice(1).join(' ').trim();
        if (!texto) throw userError('Uso: .compra pedir <o que queres comprar>');
        if (texto.length > 300) throw userError('Máximo de 300 caracteres.');
        if (reg.registos.filter((r) => r.numero === ctx.number && r.estado === 'pendente').length >= 3) throw userError('Já tens 3 pedidos pendentes.');
        const r = { id: ++reg.seq, numero: ctx.number, nome: ctx.pushName || null, texto, estado: 'pendente', em: Date.now() };
        reg.registos.push(r);
        if (reg.registos.length > 500) reg.registos.shift();
        ctx.db.save('compras');
        return ctx.reply(`🧾 Pedido #${r.id} registado como PENDENTE.\nSó fica confirmado depois de um administrador validar o pagamento na sua própria conta.`);
      }
      if (a === 'meus') {
        const m = reg.registos.filter((r) => r.numero === ctx.number).slice(-10);
        return ctx.reply(m.length ? '🧾 Os teus pedidos:\n' + m.map((r) => `#${r.id} ${estadoTxt[r.estado]} — ${r.texto.slice(0, 50)}`).join('\n') : '🧾 Ainda não tens pedidos.');
      }
      if (!admin) throw userError('Só administradores podem usar esta opção.');
      if (a === 'lista') {
        const p = reg.registos.filter((r) => r.estado === 'pendente');
        return ctx.send({ text: p.length ? `🧾 Pedidos pendentes (${p.length}):\n` + p.map((r) => `#${r.id} @${r.numero} — ${r.texto.slice(0, 60)}`).join('\n') : '🧾 Sem pedidos pendentes.', mentions: p.map((r) => r.numero + '@s.whatsapp.net') });
      }
      if (a === 'confirmar' || a === 'recusar') {
        const r = reg.registos.find((x) => x.id === Number(ctx.args[1]));
        if (!r) throw userError(`Uso: .compra ${a} <nº do pedido>`);
        if (r.estado !== 'pendente') throw userError('Esse pedido já foi tratado.');
        r.estado = a === 'confirmar' ? 'confirmado' : 'recusado';
        r.validadoPor = ctx.number; r.validadoEm = Date.now();
        ctx.db.save('compras');
        return ctx.send({ text: `🧾 Pedido #${r.id} de ${tag(r.numero + '@s.whatsapp.net')}: ${estadoTxt[r.estado]} (validado por um administrador).`, mentions: [r.numero + '@s.whatsapp.net'] });
      }
      throw userError('Uso: .compra  ·  .compra pedir <texto>  ·  .compra meus  ·  (admin) .compra lista / confirmar <nº> / recusar <nº>');
    },
  },
  ver('tabela', 'tabela', '💳', 'Tabela de preços do grupo', '💳 TABELA'),
  ver('contas', 'contas', '🏦', 'Contas do grupo', '🏦 CONTAS'),
  ver('carteira', 'carteira', '👛', 'Carteira do grupo', '👛 CARTEIRA'),
  {
    ...G, name: 'pagamento', reaction: '💰', descricao: 'Formas de pagamento do grupo',
    async run(ctx) {
      const d = commerce.dados(ctx.db, ctx.jid);
      const num = linhasNumeros(d);
      const t = d.pagamento?.texto;
      if (!t && !num) return ctx.reply('Este grupo ainda não configurou pagamento. Admin usa .setpagamento');
      await ctx.reply(['💰 PAGAMENTO', t, num].filter(Boolean).join('\n\n'));
    },
  },
  ver('megas', 'megas', '📶', 'Pacotes de megas do grupo', '📶 MEGAS'),
  ver('loja', 'loja', '🛒', 'Loja do grupo', '🛒 LOJA'),
  {
    ...G, name: 'saldo', reaction: '💎', descricao: 'Os teus pontos e pedidos neste grupo',
    async run(ctx) {
      const r = ctx.db.get('ranking').global[ctx.number];
      const reg = commerce.compras(ctx.db, ctx.jid).registos.filter((x) => x.numero === ctx.number);
      const carteira = Object.entries(commerce.dados(ctx.db, ctx.jid).saldos[ctx.number]?.saldo || {}).filter(([, v]) => v > 0).map(([u, v]) => `${v} ${u}`).join(' · ');
      await ctx.reply([
        '💎 O teu saldo Uchiha',
        (() => { const c = commerce.dados(ctx.db, ctx.jid).saldos[ctx.number]; const l = c ? Object.entries(c.saldo).filter(([, v]) => v > 0).map(([u, v]) => `${v} ${u}`).join(' · ') : ''; return `👛 Carteira do grupo: ${l || '0'}`; })(),
        `👛 Carteira neste grupo: ${carteira || '0'}`,
        `⚫ Pontos: ${r?.pontos || 0}`,
        `🧾 Pedidos neste grupo: ${reg.length} (✅ ${reg.filter((x) => x.estado === 'confirmado').length} · ⏳ ${reg.filter((x) => x.estado === 'pendente').length})`,
        (() => { const w = commerce.dados(ctx.db, ctx.jid).saldos[ctx.number]; const l = w ? Object.entries(w.saldo).filter(([, v]) => v > 0).map(([u, v]) => `${v} ${u}`).join(' · ') : ''; return `👛 Carteira do grupo: ${l || '0'}`; })(),
        (() => { const c = commerce.dados(ctx.db, ctx.jid).saldos[ctx.number]; const l = c ? Object.entries(c.saldo).filter(([, v]) => v > 0).map(([u, v]) => `${v} ${u}`).join(' · ') : ''; return `💼 Carteira do grupo: ${l || '0'}`; })(),
        '',
        'ℹ️ Pontos do bot e carteira interna do grupo (registo dos admins). O bot não vê o saldo da tua conta M-Pesa ou e-Mola.',
      ].join('\n'));
    },
  },
  carteira('mpesa', ['84', '85'], '📱'),
  carteira('emola', ['86', '87'], '📲'),
  makeToggle({ name: 'antiburlador', reaction: '🕵️', categoria: C, descricao: 'Alerta contra comprovativos falsos', precisaAdmin: false }),
];
