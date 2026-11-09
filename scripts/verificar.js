'use strict';
// Verifica se todos os ficheiros do projecto foram enviados para o servidor: node scripts/verificar.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ESPERADOS = [".npmrc", "config.json", "index.js", "package.json", "scripts/auditoria.js", "scripts/selftest.js", "scripts/verificar.js", "src/commands/_template.js", "src/commands/admin.js", "src/commands/admin3.js", "src/commands/aluguer.js", "src/commands/anime.js", "src/commands/comprovativo.js", "src/commands/conexao.js", "src/commands/dono.js", "src/commands/exemplos.js", "src/commands/extras.js", "src/commands/ferramentas.js", "src/commands/geral.js", "src/commands/gestao2.js", "src/commands/membros.js", "src/commands/mensagens.js", "src/commands/midia.js", "src/commands/nano.js", "src/commands/pagamentos.js", "src/commands/permissoes.js", "src/commands/protecoes.js", "src/commands/token.js", "src/commands/vendas.js", "src/data/aliases.js", "src/data/menu.txt", "src/database/db.js", "src/handlers/events/detector.js", "src/handlers/events/participants.js", "src/handlers/messageHandler.js", "src/handlers/registry.js", "src/protections/antiburlador.js", "src/protections/antidelete.js", "src/protections/autoresposta.js", "src/protections/concorrencia.js", "src/protections/flood.js", "src/protections/links.js", "src/protections/media.js", "src/protections/mute.js", "src/protections/nano.js", "src/protections/palavrao.js", "src/protections/ranking.js", "src/protections/store.js", "src/services/anime.js", "src/services/animeData.js", "src/services/commerce.js", "src/services/comprovativosStore.js", "src/services/connection.js", "src/services/groupCache.js", "src/services/groupSchedule.js", "src/services/lock.js", "src/services/menuData.js", "src/services/messageScheduler.js", "src/services/messageStore.js", "src/services/permissions.js", "src/services/protecao.js", "src/services/rental.js", "src/services/sms.js", "src/services/sticker.js", "src/services/tokenStore.js", "src/services/welcome.js", "src/utils/format.js", "src/utils/grupos.js", "src/utils/helpers.js", "src/utils/http.js", "src/utils/logger.js", "src/utils/media.js", "src/utils/safeReact.js", "src/utils/targets.js", "src/utils/textos.js"];
const em = [];
for (const f of ESPERADOS) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) em.push(f + '  (FALTA)');
  else if (fs.statSync(p).size === 0) em.push(f + '  (VAZIO)');
}
const estranhos = [];
try {
  for (const f of fs.readdirSync(path.join(ROOT, 'src', 'commands'))) {
    if (!ESPERADOS.includes('src/commands/' + f)) estranhos.push('src/commands/' + f);
  }
} catch { /* sem pasta */ }
if (em.length) {
  console.log('❌ Ficheiros em falta ou vazios (' + em.length + '/' + ESPERADOS.length + '):');
  em.forEach((x) => console.log('  - ' + x));
}
if (estranhos.length) {
  console.log('⚠️ Ficheiros em src/commands que não fazem parte do projecto (apaga-os se não os criaste):');
  estranhos.forEach((x) => console.log('  - ' + x));
}
if (em.length) process.exit(1);
console.log('✅ Todos os ' + ESPERADOS.length + ' ficheiros do código estão presentes.');
