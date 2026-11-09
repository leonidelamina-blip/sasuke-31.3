'use strict';
// Impede duas instâncias a usar a mesma sessão (causa comum de "Bad MAC" / sessão a cair).
const fs = require('fs');
const path = require('path');
const { sleep } = require('../utils/helpers');

const FRESCO_MS = 12000;
const BATIDA_MS = 4000;

function ler(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }

async function adquirir(dir, { esperaMs = 20000 } = {}) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const f = path.join(dir, '.lock');
  const t0 = Date.now();
  for (;;) {
    const l = ler(f);
    const fresco = l && Date.now() - l.ts < FRESCO_MS && l.pid !== process.pid;
    if (!fresco) break;
    if (Date.now() - t0 > esperaMs) throw new Error('Outra instância do bot está a usar esta sessão (auth). Pára a outra instância antes de arrancar.');
    await sleep(1000);
  }
  const escrever = () => { try { fs.writeFileSync(f, JSON.stringify({ pid: process.pid, ts: Date.now() })); } catch { /* ignora */ } };
  escrever();
  const t = setInterval(escrever, BATIDA_MS);
  t.unref?.();
  return () => { clearInterval(t); const l = ler(f); if (l && l.pid === process.pid) { try { fs.unlinkSync(f); } catch { /* ignora */ } } };
}

module.exports = { adquirir };
