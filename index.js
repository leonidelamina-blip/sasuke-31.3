'use strict';
process.title = 'sasuke-v31.1';

const config = require('./config.json');
const log = require('./src/utils/logger');
const textos = require('./src/utils/textos');
const { Database } = require('./src/database/db');
const { Permissions } = require('./src/services/permissions');
const { Rental } = require('./src/services/rental');
const { loadRegistry } = require('./src/handlers/registry');
const { SessionManager } = require('./src/services/connection');
const groupSchedule = require('./src/services/groupSchedule');

function validateConfig(c) {
  const isNum = (v) => /^\d{8,15}$/.test(String(v || ''));
  const errors = [];
  if (!isNum(c.dono?.internacional)) errors.push('dono.internacional inválido');
  if (!isNum(c.bot?.internacional)) errors.push('bot.internacional inválido');
  if (c.dono?.internacional === c.bot?.internacional) errors.push('o número do bot e o do dono não podem ser iguais');
  if (typeof c.prefixo !== 'string' || c.prefixo.length !== 1) errors.push('prefixo deve ter 1 carácter');
  if (errors.length) {
    for (const e of errors) log.error('config.json: ' + e);
    process.exit(1);
  }
}

async function main() {
  console.log('\n' + textos.TOPO + '\n');
  log.info(`${config.nome} · ${config.arquitectura} · v${config.versao}`);
  validateConfig(config);

  const db = new Database(config.databaseDir, config.database).init();
  const perms = new Permissions(db, config);
  const rental = new Rental(db, config);
  const registry = loadRegistry();
  const services = { config, db, perms, rental, registry };
  const sessions = new SessionManager(services);
  services.sessions = sessions;

  // Aviso ao grupo quando o aluguer expira (usa a sessão que gere o grupo)
  rental.startWatcher(async (gid) => {
    const rec = db.get('grupos').grupos[gid];
    const s = (rec?.sessao && sessions.get(rec.sessao)) || sessions.principal();
    if (!s) throw new Error('sem sessão disponível');
    await s.scheduler.send(gid, { text: textos.aluguelExpirado(config) });
  }, async (gid) => {
    const rec = db.get('grupos').grupos[gid];
    const s = (rec?.sessao && sessions.get(rec.sessao)) || sessions.principal();
    if (!s) throw new Error('sem sessão disponível');
    await s.scheduler.send(gid, { text: textos.aluguelUmDia(config) });
  });

  const stopSchedule = groupSchedule.start({ db, rental, config, sessions });

  let closing = false;
  const shutdown = async (sinal) => {
    if (closing) return;
    closing = true;
    log.info(`Sinal ${sinal} recebido. A encerrar com segurança...`);
    try {
      rental.stopWatcher();
      stopSchedule();
      await sessions.stopAll();
      db.close();
    } catch (e) {
      log.error('Erro ao encerrar:', e);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (e) => log.error('unhandledRejection:', e));
  process.on('uncaughtException', (e) => log.error('uncaughtException:', e));

  await sessions.add(config.sessaoPrincipal, { phone: config.bot.internacional }, { persist: false });
  await sessions.restore();
}

main().catch((e) => {
  log.error('Falha fatal no arranque:', e);
  process.exit(1);
});
