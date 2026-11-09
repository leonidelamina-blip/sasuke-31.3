'use strict';

const DAY = 86400000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const digits = (s) => String(s || '').replace(/\D/g, '');

/** "[NUMERO]:12@s.whatsapp.net" -> "[NUMERO]" */
function jidToNumber(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0];
}

const numberToJid = (n) => digits(n) + '@s.whatsapp.net';
const isGroupJid = (j) => String(j || '').endsWith('@g.us');

function formatDate(ms, tz = 'Africa/Maputo') {
  try {
    return new Intl.DateTimeFormat('pt-PT', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

function daysLeft(expMs, now = Date.now()) {
  return Math.max(0, Math.ceil((expMs - now) / DAY));
}

/** Inteiro entre 1 e 3650, ou null. */
function parseDays(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 3650 ? n : null;
}

function formatUptime(sec) {
  sec = Math.floor(sec);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${d ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

module.exports = { DAY, sleep, digits, jidToNumber, numberToJid, isGroupJid, formatDate, daysLeft, parseDays, formatUptime };
