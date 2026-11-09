'use strict';
/**
 * Sistema de comprovativos (por grupo, sem nenhum número fixo no código).
 *  - handleAuto(ctx): lê SMS de M-Pesa/e-Mola colados no grupo ANTES dos comandos.
 *  - .comprovativo VALOR REFERENCIA [operadora] (+ foto) · pendentes · aprovar ID · recusar ID · ver ID
 *  - .auto-comprovativo on/off · .verificarsms <texto> · .verificarrecibo <ID|REF> · .debugrecibo <ID|REF>
 * O bot NUNCA aprova sozinho: só um administrador aprova (.comprovativo aprovar ID).
 */
const commerce = require('../services/commerce');
const store = require('../services/comprovativosStore');
const sms = require('../services/sms');
const { ativo, isento, setProt, prot, warnings } = require('../services/protecao');
const { userError, onOff, quotedText, tag } = require('../utils/format');
const { formatDate, jidToNumber } = require('../utils/helpers');
const log = require('../utils/logger');

const CAT = 'COMPRAS & MEGAS';
const NOME_OP = { mpesa: 'M-Pesa', emola: 'e-Mola', outra: 'Outra operadora' };
const EST = { pendente: '⏳ pendente', aprovado: '✅ aprovado', recusado: '❌ recusado' };

const adminsDoGrupo = (ctx, max = 8) => (ctx.meta?.participants || []).filter((p) => p.admin).slice(0, max).map((p) => p.id);

/** Descarrega a foto da mensagem (ou da mensagem respondida). Devolve Buffer ou null. Nunca lança erro. */
async function obterFoto(ctx) {
  try {
    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
    let alvo = null;
    if (ctx.type === 'imageMessage') alvo = ctx.msg;
    else if (ctx.quotedMessage?.imageMessage) {
      alvo = { key: { remoteJid: ctx.jid, id: ctx.quotedId, participant: ctx.quotedSender }, message: { imageMessage: ctx.quotedMessage.imageMessage } };
    }
    if (!alvo) return null;
    const buf = await downloadMediaMessage(alvo, 'buffer', {}, { reuploadRequest: ctx.sock.updateMediaMessage });
    return Buffer.isBuffer(buf) ? buf : null;
  } catch (e) {
    log.warn('Foto do comprovativo não descarregada: ' + e.message);
    return null;
  }
}

function resumo(r) {
  const quanto = r.valor === null || r.valor === undefined ? (r.descricao || 'depósito') : sms.fmtValor(r.valor);
  return `#${r.id} ${EST[r.estado]} · ${r.tipo === 'deposito' ? 'Depósito' : (NOME_OP[r.operadora] || r.operadora)} · ${quanto} · ref ${r.referencia}`;
}

/** Chamado em TODAS as mensagens, antes dos comandos. Nunca lança erro. */
async function handleAuto(ctx) {
  try {
    if (!ctx.isGroup || isento(ctx) || !ctx.text || !ativo(ctx.db, ctx.jid, 'autocomprovativo')) return false;
    const info = sms.parse(ctx.text);
    if (!info) return false;

    const dup = store.porReferencia(ctx.db, ctx.jid, info.id);
    const numeros = commerce.dados(ctx.db, ctx.jid)[info.servico];
    let destino = 'sem-registo'; let destinoNome = null;
    if (numeros.length) {
      const m = numeros.find((n) => n.numero === info.destinoNumero);
      destino = m ? 'ok' : 'diferente';
      destinoNome = m?.nome || null;
    }
    const idade = sms.idadeMin(info, ctx.config.fusoHorario);

    let rec = null;
    if (!dup) {
      const alertas = [];
      if (destino === 'diferente') alertas.push('destino fora dos números do grupo');
      if (idade !== null && idade > 120) alertas.push('comprovativo antigo');
      rec = store.criar(ctx.db, ctx.jid, {
        operadora: info.servico, valor: info.valor, referencia: info.id, numero: ctx.number, nome: ctx.pushName || null,
        origem: 'auto', destino: info.destinoNumero, destinoValidado: destino === 'ok', alertas, texto: ctx.text.slice(0, 600),
      });
    } else {
      warnings(ctx.db).ocorrencia(ctx.jid, ctx.number, `comprovativo repetido ${info.id}`, 'comprovativo');
    }
    if (destino === 'diferente') warnings(ctx.db).ocorrencia(ctx.jid, ctx.number, `destino fora dos números ${info.servico} do grupo`, 'comprovativo');

    const admins = adminsDoGrupo(ctx);
    const m = sms.mensagens(info, { pedidoId: rec?.id || null, duplicadoDe: dup?.id || null, destino, destinoNome, idade, admins: admins.map(jidToNumber) }, ctx.number);
    await ctx.send({ text: m.cartao, mentions: [ctx.sender, ...admins] }).catch(() => {});
    await ctx.send({ text: m.cliente, mentions: [ctx.sender] }).catch(() => {});
  } catch (e) {
    log.error('handleAuto (comprovativo):', e);
  }
  return false; // nunca consome a mensagem
}

function exigirAdmin(ctx) {
  if (!ctx.isAdmin && !ctx.isOwner) throw userError('Só administradores podem usar esta opção.');
}

const comprovativo = {
  name: 'comprovativo',
  alias: [],
  desc: 'Regista um comprovativo (VALOR REFERENCIA + foto) e gere pendentes/aprovar/recusar',
  category: CAT,
  reaction: '🧾',
  groupOnly: true,
  handleAuto,
  async run(ctx) {
    const a = (ctx.args[0] || '').toLowerCase();

    if (a === 'pendentes') {
      exigirAdmin(ctx);
      const p = store.pendentes(ctx.db, ctx.jid);
      return ctx.send({ text: p.length ? `🧾 Comprovativos pendentes (${p.length}):\n` + p.slice(-20).map((r) => `${resumo(r)} · @${r.numero}`).join('\n') + '\n\n.comprovativo aprovar ID  ·  .comprovativo recusar ID' : '🧾 Sem comprovativos pendentes.', mentions: p.slice(-20).map((r) => r.numero + '@s.whatsapp.net') });
    }

    if (a === 'aprovar' || a === 'recusar') {
      exigirAdmin(ctx);
      if (!ctx.args[1]) throw userError(`Uso: .comprovativo ${a} ID`);
      const motivo = ctx.args.slice(2).join(' ');
      const r = store.decidir(ctx.db, ctx.jid, ctx.args[1], a === 'aprovar' ? 'aprovado' : 'recusado', ctx.number, motivo);
      const cliente = r.numero + '@s.whatsapp.net';
      return ctx.send({
        text: `🧾 Comprovativo #${r.id} de ${tag(cliente)}: ${EST[r.estado]} por ${tag(ctx.sender)}.${r.motivo ? '\n📝 ' + r.motivo : ''}`,
        mentions: [cliente, ctx.sender],
      });
    }

    if (a === 'ver') {
      exigirAdmin(ctx);
      const r = store.porId(ctx.db, ctx.jid, ctx.args[1]) || store.porReferencia(ctx.db, ctx.jid, ctx.args[1] || '');
      if (!r) throw userError('Comprovativo não encontrado neste grupo.');
      return ctx.reply(`🧾 ${resumo(r)}\n👤 +${r.numero}\n🕒 ${formatDate(r.em, ctx.config.fusoHorario)}${r.destino ? '\n📞 Destino: ' + r.destino : ''}${r.alertas?.length ? '\n⚠️ ' + r.alertas.join(', ') : ''}${r.foto ? '\n🖼️ Foto guardada' : ''}`);
    }

    // Registo manual: .comprovativo VALOR REFERENCIA [operadora]  (+ foto na mesma mensagem ou respondendo a uma foto)
    if (!ctx.args[0]) {
      const pagamento = commerce.dados(ctx.db, ctx.jid).pagamento;
      return ctx.reply('🧾 Para registar um comprovativo:\n.comprovativo VALOR REFERENCIA  (junta a foto ou responde a ela)\n\nSe colares o SMS da M-Pesa/e-Mola, o bot lê-o sozinho quando o administrador activar .auto-comprovativo on.\n\nAdmin: .comprovativo pendentes · aprovar ID · recusar ID · ver ID'
        + (pagamento ? '' : '\n\nℹ️ Este grupo ainda não configurou pagamento. Admin usa .setpagamento'));
    }
    const valor = sms.numero(ctx.args[0]);
    const ref = String(ctx.args[1] || '').toUpperCase();
    if (valor === null || valor <= 0) throw userError('Valor inválido. Uso: .comprovativo VALOR REFERENCIA');
    if (!/^[A-Z0-9][A-Z0-9._-]{3,29}$/.test(ref)) throw userError('Referência inválida (4 a 30 letras/números). Uso: .comprovativo VALOR REFERENCIA');
    const dup = store.porReferencia(ctx.db, ctx.jid, ref);
    if (dup) throw userError(`Esta referência já foi registada (comprovativo #${dup.id}, ${dup.estado}).`);
    const op = (ctx.args[2] || '').toLowerCase().replace(/[^a-z-]/g, '');
    const operadora = ['mpesa', 'm-pesa'].includes(op) ? 'mpesa' : ['emola', 'e-mola'].includes(op) ? 'emola' : 'outra';

    const r = store.criar(ctx.db, ctx.jid, { operadora, valor, referencia: ref, numero: ctx.number, nome: ctx.pushName || null, origem: 'manual' });
    const foto = await obterFoto(ctx);
    if (foto) {
      try { r.foto = store.guardarFoto(ctx.jid, r.id, foto); ctx.db.save('comprovativos'); } catch (e) { log.warn('Foto não guardada: ' + e.message); }
    }
    const admins = adminsDoGrupo(ctx);
    await ctx.send({
      text: `🧾 Comprovativo #${r.id} registado: ⏳ PENDENTE\n💰 ${sms.fmtValor(valor)} · ref ${ref}${foto && r.foto ? '\n🖼️ Foto guardada' : ''}\n\n👑 Admins: ${admins.map(tag).join(' ')}\n➡️ .comprovativo aprovar ${r.id}  ·  .comprovativo recusar ${r.id}`,
      mentions: admins,
    });
  },
};

const autoComprovativo = {
  name: 'auto-comprovativo',
  alias: [],
  desc: 'Liga/desliga a leitura automática de comprovativos M-Pesa/e-Mola',
  category: 'AUTOMAÇÕES',
  reaction: '⏰',
  groupOnly: true,
  level: 'admin',
  nuncaLiberar: true,
  async run(ctx) {
    const st = onOff(ctx.args[0]);
    const cur = prot(ctx.db, ctx.jid, 'autocomprovativo')?.ativo;
    if (st === null) return ctx.reply(`🧾 Comprovativo automático: ${cur ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\nUso: .auto-comprovativo on  ·  .auto-comprovativo off`);
    setProt(ctx.db, ctx.jid, 'autocomprovativo', { ativo: st });
    const d = commerce.dados(ctx.db, ctx.jid);
    const falta = !d.mpesa.length && !d.emola.length;
    await ctx.reply(`🧾 Comprovativo automático: ${st ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}` + (st && falta ? '\n⚠️ Regista os números do grupo (.addmpesa / .addemola) para o destino ser validado.' : ''));
  },
};

const verificarsms = {
  name: 'verificarsms',
  alias: [],
  desc: 'Analisa um SMS de pagamento (cole ou responda) sem o registar',
  category: CAT,
  reaction: '🔍',
  async run(ctx) {
    const t = ctx.argText || quotedText(ctx);
    if (!t) throw userError('Cola o texto do SMS depois do comando, ou responde a ele com .verificarsms');
    const i = sms.parse(t);
    if (!i) return ctx.reply('🔍 Não reconheci este texto como SMS de pagamento M-Pesa ou e-Mola.\nℹ️ Recebimentos e mensagens normais não são lidos.');
    const idade = sms.idadeMin(i, ctx.config.fusoHorario);
    const dup = ctx.isGroup ? store.porReferencia(ctx.db, ctx.jid, i.id) : null;
    await ctx.reply([
      `🔍 SMS ${NOME_OP[i.servico]} reconhecido`, `🔑 Referência: ${i.id}`, `💰 Valor: ${sms.fmtValor(i.valor)}`,
      i.destinoNumero ? `📞 Destino: ${i.destinoNumero}${i.destinoNome ? ' — ' + i.destinoNome : ''}` : null,
      i.quando ? `🕒 No SMS: ${String(i.quando.dia).padStart(2, '0')}/${String(i.quando.mes).padStart(2, '0')}/${i.quando.ano} ${String(i.quando.h).padStart(2, '0')}:${String(i.quando.min).padStart(2, '0')}${idade !== null ? ` (há ${idade} min)` : ''}` : null,
      dup ? `🚫 Esta referência já foi registada neste grupo (#${dup.id}).` : null,
      '', 'ℹ️ Isto só lê o texto. Não prova pagamento: o administrador confirma na app da operadora.',
    ].filter((x) => x !== null).join('\n'));
  },
};

const buscar = (ctx) => {
  const k = ctx.args[0];
  if (!k) throw userError('Uso: .verificarrecibo ID  (ou a referência)');
  const r = (/^\d+$/.test(k) ? store.porId(ctx.db, ctx.jid, k) : null) || store.porReferencia(ctx.db, ctx.jid, k);
  if (!r) throw userError('Comprovativo não encontrado neste grupo.');
  return r;
};

const verificarrecibo = {
  name: 'verificarrecibo', alias: [], desc: 'Mostra o estado de um comprovativo (ID ou referência)', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '🧾', groupOnly: true, level: 'admin',
  async run(ctx) { const r = buscar(ctx); await ctx.reply(`🧾 ${resumo(r)}\n👤 +${r.numero}\n🕒 ${formatDate(r.em, ctx.config.fusoHorario)}${r.decididoPor ? `\n✍️ Decidido por +${r.decididoPor}` : ''}`); },
};

const debugrecibo = {
  name: 'debugrecibo', alias: [], desc: 'Mostra os dados internos de um comprovativo', category: 'OUTROS • ADMINISTRAÇÃO', reaction: '🛠️', groupOnly: true, level: 'admin',
  async run(ctx) {
    const r = { ...buscar(ctx) };
    if (r.texto) r.texto = r.texto.slice(0, 200);
    await ctx.reply('🛠️ ' + JSON.stringify(r, null, 1).slice(0, 3000));
  },
};

module.exports = [comprovativo, autoComprovativo, verificarsms, verificarrecibo, debugrecibo];
