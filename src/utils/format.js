'use strict';
const crypto = require('crypto');
const { jidToNumber } = require('./helpers');

/** Fonte 1 oficial: itálico negrito matemático (𝑺𝑨𝑺𝑼𝑲𝑬). */
function fonte1(s) {
  return [...String(s)].map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D468 + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D482 + c - 97);
    return ch;
  }).join('');
}

function onOff(a) {
  a = String(a || '').toLowerCase();
  if (['on', 'ligar', 'ativar', 'activar', '1', 'sim'].includes(a)) return true;
  if (['off', 'desligar', 'desativar', 'desactivar', '0', 'nao', 'não'].includes(a)) return false;
  return null;
}

/** Erro cuja mensagem é mostrada ao utilizador. */
function userError(msg) { const e = new Error(msg); e.userMessage = msg; return e; }

const pick = (arr) => arr[crypto.randomInt(arr.length)];
const randInt = (min, max) => crypto.randomInt(min, max + 1);
const hashInt = (s) => parseInt(crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 8), 16);
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
const tag = (jid) => '@' + jidToNumber(jid);

function botNumbers(ctx) {
  const u = ctx.sock?.user || {};
  return [u.id, u.lid].filter(Boolean).map(jidToNumber);
}

function quotedText(ctx) {
  const q = ctx.quotedMessage;
  if (!q) return '';
  return q.conversation || q.extendedTextMessage?.text || q.imageMessage?.caption || q.videoMessage?.caption || '';
}

function tsMs(msg) {
  const t = msg.messageTimestamp;
  const n = typeof t === 'number' ? t : (t && t.toNumber ? t.toNumber() : Number(t));
  return (n || 0) * 1000;
}

function waitEvent(emitter, evt, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { emitter.off(evt, h); reject(userError('Tempo esgotado à espera de resposta.')); }, ms);
    const h = (v) => { clearTimeout(t); emitter.off(evt, h); resolve(v); };
    emitter.on(evt, h);
  });
}

function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

module.exports = { fonte1, onOff, userError, pick, randInt, hashInt, norm, chunk, tag, botNumbers, quotedText, tsMs, waitEvent, formatDuration };
