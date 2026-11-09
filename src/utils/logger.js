'use strict';
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
const MAX_BYTES = 5 * 1024 * 1024;

try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ignora */ }

// Rotação simples no arranque: ficheiros > 5 MB passam a .old
for (const f of ['bot.log', 'errors.log']) {
  try {
    const p = path.join(LOG_DIR, f);
    if (fs.existsSync(p) && fs.statSync(p).size > MAX_BYTES) fs.renameSync(p, p + '.old');
  } catch { /* ignora */ }
}

const ts = () => new Date().toISOString();

function fmt(args) {
  return args.map((x) => {
    if (x instanceof Error) return x.stack || x.message;
    if (x && typeof x === 'object') { try { return JSON.stringify(x); } catch { return String(x); } }
    return String(x);
  }).join(' ');
}

function write(file, line) {
  try { fs.appendFile(path.join(LOG_DIR, file), line + '\n', () => {}); } catch { /* ignora */ }
}

const log = {
  info: (...a) => { const l = `[${ts()}] INFO  ${fmt(a)}`; console.log(l); write('bot.log', l); },
  warn: (...a) => { const l = `[${ts()}] WARN  ${fmt(a)}`; console.warn(l); write('bot.log', l); },
  error: (...a) => {
    const l = `[${ts()}] ERROR ${fmt(a)}`;
    console.error(l); write('bot.log', l); write('errors.log', l);
  },
  debug: (...a) => { if (process.env.DEBUG) console.log(`[${ts()}] DEBUG ${fmt(a)}`); },
};

module.exports = log;
