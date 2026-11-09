'use strict';
const { localParts } = require('./groupSchedule');
const { fonte1 } = require('../utils/format');

const semAcentos = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

function numero(s) {
  let x = String(s).trim();
  if (x.includes(',') && x.includes('.')) x = x.replace(/,/g, '');
  else if (/,\d{1,2}$/.test(x)) x = x.replace(',', '.');
  else x = x.replace(/,/g, '');
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function dataLocal(dia, mes, ano, h, min, ap) {
  ano = Number(ano); if (ano < 100) ano += 2000;
  h = Number(h); min = Number(min); dia = Number(dia); mes = Number(mes);
  if (ap) { ap = ap.toUpperCase(); if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0; }
  if (h > 23 || min > 59 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return { dia, mes, ano, h, min, localMs: Date.UTC(ano, mes - 1, dia) + (h * 60 + min) * 60000 };
}

function parseMpesa(t) {
  const id = t.match(/\bConfirmado\s+([A-Z0-9]{8,12})\b/i);
  const valor = t.match(/\b(?:transferiste|pagaste|enviaste)\s+([\d.,]+)\s*MT\b/i);
  if (!id || !valor) return null;
  const v = numero(valor[1]);
  if (v === null || v <= 0) return null;
  const taxa = t.match(/taxa foi de\s+([\d.,]+)\s*MT/i);
  const dest = t.match(/\bpara\s+(\d{9})\b(?:\s*-\s*(.+?))?(?=\s+aos?\s|\.\s|\.$|$)/i);
  const d = t.match(/\baos?\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+as\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  return {
    servico: 'mpesa', id: id[1].toUpperCase(), valor: v, taxa: taxa ? numero(taxa[1]) : null,
    destinoNumero: dest ? dest[1] : null, destinoNome: dest && dest[2] ? dest[2].trim() : null,
    quando: d ? dataLocal(d[1], d[2], d[3], d[4], d[5], d[6]) : null,
  };
}

// e-Mola: "ID da transacao [REFERENCIA]. Transferiste [VALOR]MT para conta [NUMERO], nome: [NOME] as HH:MM:SS de DD/MM/AAAA. Taxa: [TAXA]MT. ..."
function parseEmola(t) {
  const id = t.match(/\bID da transacao[:\s]+([A-Z0-9]+(?:\.[A-Z0-9]+)*)/i);
  const valor = t.match(/\b(?:transferiste|pagaste|enviaste)\s+([\d.,]+)\s*MT\b/i);
  if (!id || !valor || id[1].length < 8) return null;
  const v = numero(valor[1]);
  if (v === null || v <= 0) return null;
  const taxa = t.match(/\bTaxa:?\s*([\d.,]+)\s*MT/i);
  const dest = t.match(/\bpara\s+conta\s+(\d{9})\b(?:,?\s*nome:?\s*(.+?))?(?=\s+as\s+\d|\.\s|\.$|$)/i);
  const d = t.match(/\bas\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+de\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  return {
    servico: 'emola', id: id[1].toUpperCase(), valor: v, taxa: taxa ? numero(taxa[1]) : null,
    destinoNumero: dest ? dest[1] : null, destinoNome: dest && dest[2] ? dest[2].trim() : null,
    quando: d ? dataLocal(d[3], d[4], d[5], d[1], d[2], null) : null,
  };
}

/**
 * Lê o SMS de pagamento M-Pesa ou e-Mola colado/reencaminhado. Devolve null se não parecer um SMS de pagamento
 * (inclui recebimentos). NÃO prova que o pagamento existe.
 */
function parse(texto) {
  const t = semAcentos(texto);
  return parseMpesa(t) || parseEmola(t);
}

/** Idade do comprovativo em minutos (hora local do grupo); null se o SMS não traz data. */
function idadeMin(info, tz, now = Date.now()) {
  if (!info.quando) return null;
  const lp = localParts(now, tz);
  const [y, m, d] = lp.date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) + lp.minutes * 60000 - info.quando.localMs) / 60000);
}

const p2 = (n) => String(n).padStart(2, '0');
const fmtQuando = (q) => `${p2(q.dia)}/${p2(q.mes)}/${q.ano} ${p2(q.h)}:${p2(q.min)}`;
const fmtValor = (v) => `${v.toFixed(2)} MT`;

const NOME = { mpesa: 'M-Pesa', emola: 'e-Mola' };
const CAB = (titulo) => ['╔═══ 🩸 𝑺𝑯𝑨𝑫𝑶𝑾 𝑮𝑶𝑫 🩸 ═══╗', `👁️ ${fonte1(titulo)}`, '╚════════════════════════╝'].join('\n');

/**
 * Monta as duas mensagens (cartão + aviso ao cliente) em estilo Sasuke.
 * estado: { pedidoId, duplicadoDe, destino: 'ok'|'diferente'|'sem-registo', destinoNome, idade }
 */
function mensagens(info, estado, numeroCliente) {
  const linhas = [CAB('COMPROVATIVO DETECTADO'), '', `🧾 ${NOME[info.servico]}`, `🔑 Chave: ${info.id}`, `💰 Valor: ${fmtValor(info.valor)}`];
  if (info.destinoNumero) linhas.push(`📞 Destino: ${info.destinoNumero}${info.destinoNome ? ' — ' + info.destinoNome : ''}`);
  if (info.quando) linhas.push(`🕒 No SMS: ${fmtQuando(info.quando)}`);
  linhas.push('');

  const alertas = [];
  if (estado.duplicadoDe) alertas.push(`🚫 CHAVE JÁ REGISTADA antes (pedido #${estado.duplicadoDe}). Possível reutilização.`);
  if (estado.destino === 'ok') linhas.push(`🛡️ Destino validado: ${estado.destinoNome || info.destinoNome || info.destinoNumero}`);
  else if (estado.destino === 'diferente') alertas.push(`🚨 O destino NÃO coincide com nenhum número ${NOME[info.servico]} deste grupo.`);
  else linhas.push(`ℹ️ Sem número ${NOME[info.servico]} registado no grupo (${info.servico === 'emola' ? '.addemola' : '.addmpesa'}): destino não validado.`);
  if (estado.idade !== null && estado.idade > 120) alertas.push(`⚠️ Comprovativo antigo (${Math.round(estado.idade / 60)} h).`);
  if (info.destinoNumero === null) linhas.push('ℹ️ O SMS não traz o número de destino.');
  linhas.push(...alertas);
  if (estado.pedidoId) linhas.push(`🧾 Comprovativo #${estado.pedidoId}: ⏳ PENDENTE`);
  if (estado.admins && estado.admins.length) {
    linhas.push('', `👑 Admins: ${estado.admins.map((n) => '@' + n).join(' ')}`);
    if (estado.pedidoId) linhas.push(`➡️ .comprovativo aprovar ${estado.pedidoId}  ·  .comprovativo recusar ${estado.pedidoId}`);
  }

  const problema = !!(estado.duplicadoDe || estado.destino === 'diferente' || (estado.idade !== null && estado.idade > 120));
  const cliente = problema
    ? [`🩸 @${numeroCliente}, este comprovativo tem pontos a verificar.`, '', '⚠️ Um administrador vai analisar antes de entregar qualquer produto.', '', '⚠️ Comprovativos falsos ficam registados e podem resultar em banimento.']
    : [`🩸 @${numeroCliente}, o teu comprovativo foi registado.`, '', '⏳ Aguarda enquanto um administrador confirma o pagamento na app ' + NOME[info.servico] + '.', '', '⚠️ Comprovativos falsos ficam registados e podem resultar em banimento.', '', '👁️ O administrador já volta com a confirmação.'];
  return { cartao: linhas.join('\n'), cliente: cliente.join('\n'), problema };
}

module.exports = { parse, idadeMin, mensagens, fmtValor, numero };
