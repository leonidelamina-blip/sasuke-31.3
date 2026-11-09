'use strict';
const { userError } = require('./format');

const MAX_BYTES = 20 * 1024 * 1024;

async function req(url, { timeout = 15000, headers = {} } = {}, kind) {
  if (process.env.SASUKE_OFFLINE) throw new Error('offline');
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'SasukeBot/31.1', Accept: '*/*', ...headers } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (kind === 'json') return await r.json();
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw new Error('ficheiro demasiado grande');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('ficheiro demasiado grande');
    return buf;
  } finally {
    clearTimeout(t);
  }
}

const fetchJson = (url, o) => req(url, o, 'json');
const fetchBuffer = (url, o) => req(url, o, 'buffer');
const indisponivel = (fonte) => userError(`Fonte externa (${fonte}) indisponível de momento. Tenta mais tarde.`);

module.exports = { fetchJson, fetchBuffer, indisponivel };
