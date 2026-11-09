'use strict';
// Testes dos módulos que não dependem do WhatsApp: node scripts/selftest.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config.json');
const { Database } = require('../src/database/db');
const { Permissions } = require('../src/services/permissions');
const { Rental } = require('../src/services/rental');
const { MessageScheduler } = require('../src/services/messageScheduler');
const { loadCommands } = require('../src/handlers/registry');
const { DAY } = require('../src/utils/helpers');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sasuke-'));
const results = [];
async function t(nome, fn) { try { await fn(); results.push([true, nome]); } catch (e) { results.push([false, nome, e.message]); } }
const G1 = '120363000000000001@g.us'; const G2 = '120363000000000002@g.us';
const NUM = (pref, k) => pref + String(k).padStart(7, '0'); // números de teste gerados (sem números fixos no código)

(async () => {
  // ---------- Base de dados ----------
  await t('DB: cria ficheiros (incl. comprovativos.json) e persiste após reinício', () => {
    const dir = path.join(tmp, 'db1');
    const db = new Database(dir, { backupIntervaloMin: 0 }).init();
    db.groupOf('comprovativos', G1, () => ({ seq: 1, registos: [{ id: 1 }] }));
    db.close();
    const db2 = new Database(dir, { backupIntervaloMin: 0 }).init();
    assert.strictEqual(db2.get('comprovativos').grupos[G1].seq, 1);
    for (const n of ['grupos', 'alugueis', 'usuarios', 'advertencias', 'nano', 'configuracoes', 'compras', 'ranking', 'pagamentos', 'comprovativos']) assert.ok(fs.existsSync(path.join(dir, n + '.json')), n);
    db2.close();
  });
  await t('DB: recupera ficheiro corrompido a partir de backup', () => {
    const dir = path.join(tmp, 'db2');
    const db = new Database(dir, { backupIntervaloMin: 0 }).init();
    db.groupOf('nano', G1, () => ({ x: 1 })); db.close();
    fs.writeFileSync(path.join(dir, 'nano.json'), '{ isto não é json');
    const db2 = new Database(dir, { backupIntervaloMin: 0 }).init();
    assert.strictEqual(db2.get('nano').grupos[G1].x, 1); db2.close();
  });
  await t('DB: dados de pagamento de grupos diferentes ficam separados', () => {
    const db = new Database(path.join(tmp, 'db3'), { backupIntervaloMin: 0 }).init();
    const commerce = require('../src/services/commerce');
    commerce.setCampo(db, G1, 'pagamento', 'A', 'x'); commerce.setCampo(db, G2, 'pagamento', 'B', 'x');
    assert.strictEqual(commerce.getCampo(db, G1, 'pagamento'), 'A'); assert.strictEqual(commerce.getCampo(db, G2, 'pagamento'), 'B');
    db.close();
  });

  // ---------- Aluguer ----------
  const db = new Database(path.join(tmp, 'db5'), { backupIntervaloMin: 0 }).init();
  const rental = new Rental(db, config);
  await t('Aluguer: alugar, renovar, tirar dias, anular e expirar', () => {
    assert.strictEqual(rental.alugar(G1, 30).acao, 'alugar');
    const antes = rental.get(G1).expira;
    assert.strictEqual(rental.alugar(G1, 10).acao, 'renovar');
    assert.strictEqual(rental.get(G1).expira, antes + 10 * DAY);
    assert.strictEqual(rental.tirarDias(G1, 5).diasRestantes, 35);
    assert.strictEqual(rental.tirarDias(G1, 35).expirou, true);
    assert.strictEqual(rental.tick().length, 1);
    rental.markNotified(G1);
    rental.alugar(G1, 7); rental.anular(G1);
    assert.strictEqual(rental.info(G1).estado, 'cancelado');
    assert.throws(() => rental.alugar(G1, 0), /inválido/);
    assert.throws(() => rental.alugar('x@s.whatsapp.net', 5), /grupo inválido/);
  });
  await t('Aluguer: aviso "falta 1 dia" só uma vez e só para prazos > 1 dia', () => {
    rental.alugar(G2, 3); const r = rental.get(G2);
    assert.strictEqual(rental.umDia().length, 0); // ainda faltam 3 dias
    r.inicio = Date.now() - 2 * DAY; r.expira = Date.now() + 20 * 3600000;
    assert.deepStrictEqual(rental.umDia().map((x) => x.gid), [G2]);
    rental.markUmDia(G2);
    assert.strictEqual(rental.umDia().length, 0);
    rental.alugar(G2, 5); assert.strictEqual(rental.get(G2).avisoUmDia, false); // renovar volta a permitir o aviso
    const g3 = '120363000000000003@g.us'; rental.alugar(g3, 1);
    assert.strictEqual(rental.umDia().some((x) => x.gid === g3), false); // aluguer de 1 dia não avisa logo
  });
  await t('Textos de aluguer: exactamente como pedido', () => {
    const tx = require('../src/utils/textos');
    assert.strictEqual(tx.aluguelUmDia(config), `Falta 1 dia, renova no canal: ${config.canal.link}`);
    assert.strictEqual(tx.aluguelExpirado(config), `Aluguer expirado, entra no canal para renovar: ${config.canal.link}`);
  });

  // ---------- Permissões ----------
  const perms = new Permissions(db, config);
  await t('Permissões: dono, níveis, clientes, .liberar e modo livre', () => {
    assert.ok(perms.isOwner([config.dono.internacional])); assert.ok(!perms.isOwner([config.bot.internacional]));
    const adm = { name: 'ban', level: 'admin' }; const seguro = { name: 'liberar', level: 'admin', nuncaLiberar: true };
    const m = { isOwner: false, isAdmin: false, gid: G1, number: '111' };
    assert.strictEqual(perms.can(adm, m).ok, false);
    perms.setLiberado(G1, 'ban', 'membro'); assert.strictEqual(perms.can(adm, m).ok, true);
    assert.strictEqual(perms.can(adm, { ...m, gid: G2 }).ok, false);
    perms.removeLiberado(G1, 'ban'); perms.setModoLivre(G1, true);
    assert.strictEqual(perms.can(adm, m).ok, true); assert.strictEqual(perms.can(seguro, m).ok, false);
    assert.ok(perms.addCliente(G1, '111')); assert.strictEqual(perms.level({ gid: G1, number: '111' }), 'cliente');
  });

  // ---------- Fila de mensagens ----------
  const fast = { intervals: { text: 20, react: 5, default: 20 }, globalGapMs: 5, retryBaseMs: 20, typing: false, dedupeWindowMs: 300 };
  const mk = () => { const s = { sent: [], fail: 0, async sendMessage(j, c) { if (s.fail > 0) { s.fail--; throw new Error('falha simulada'); } s.sent.push([j, c]); return {}; } }; return s; };
  await t('Fila: ordem, duplicados, retentativas e limite', async () => {
    const sc = new MessageScheduler(fast); const sock = mk(); sc.setSocket(sock); sc.setReady(true);
    await Promise.all([1, 2, 3].map((n) => sc.send('a@g.us', { text: 'm' + n })));
    assert.deepStrictEqual(sock.sent.map((x) => x[1].text), ['m1', 'm2', 'm3']);
    await Promise.all([sc.send('b@g.us', { text: 'igual' }), sc.send('b@g.us', { text: 'igual' })]);
    assert.strictEqual(sock.sent.filter((x) => x[0] === 'b@g.us').length, 1);
    sock.fail = 2; await sc.send('c@g.us', { text: 'retry' }); assert.ok(sock.sent.some((x) => x[0] === 'c@g.us'));
    const sc2 = new MessageScheduler({ ...fast, maxRetries: 1 }); sc2.setSocket(sock); sc2.setReady(true);
    await assert.rejects(sc2.enqueue('d@g.us', 'text', async () => { throw new Error('x'); }, {}), /x/);
    sc.stop(); sc2.stop();
  });

  // ---------- safeReact ----------
  await t('safeReact: só 1 emoji válido; nunca lança erro', async () => {
    const { safeReact, emojiValido } = require('../src/utils/safeReact');
    const enviados = []; const sock = { async sendMessage(j, c) { enviados.push(c); } };
    const m = { key: { remoteJid: 'a@g.us', id: '1' } };
    for (const e of ['abc', '😀😀', '', ' ', null, undefined, 5, 'x'.repeat(30), '👍 👍']) await safeReact(sock, m, e);
    assert.strictEqual(enviados.length, 0);
    await safeReact(sock, m, '🩸'); await safeReact(sock, m, 'ℹ️');
    assert.strictEqual(enviados.length, 2);
    await safeReact({ async sendMessage() { throw new Error('falha'); } }, m, '👍'); // não lança
    await safeReact(null, m, '👍'); // não lança
    assert.ok(emojiValido('✅') && !emojiValido('ok'));
  });

  // ---------- Carregador ----------
  await t('Carregador: category/alias/desc por defeito, reaction opcional, ficheiros maus ignorados', () => {
    const dir = path.join(tmp, 'cmds'); fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'a.js'), "module.exports={name:'a',run(){}};"); // sem category, alias, desc, reaction
    fs.writeFileSync(path.join(dir, 'b.js'), "module.exports={name:'b',alias:['bb'],desc:'x',category:'X',reaction:null,run(){}};");
    fs.writeFileSync(path.join(dir, 'c.js'), "module.exports={name:'c',reaction:'abc xx',run(){}};"); // reaction inválida -> null
    fs.writeFileSync(path.join(dir, '.compra.js'), "module.exports={name:'.compra'};");
    fs.writeFileSync(path.join(dir, 'sem-run.js'), "module.exports={name:'d'};");
    fs.writeFileSync(path.join(dir, 'quebrado.js'), 'throw new Error("x")');
    fs.writeFileSync(path.join(dir, 'dup.js'), "module.exports={name:'a',run(){}};");
    const r = loadCommands(dir, { tabela: { a: ['aa', { nome: 'a-on', args: ['on'] }, 'bb'] } });
    assert.deepStrictEqual(r.list.map((c) => c.name).sort(), ['a', 'b', 'c']);
    assert.strictEqual(r.map.get('a').category, 'OUTROS'); assert.deepStrictEqual(r.map.get('a').alias.sort(), ['a-on', 'aa']);
    assert.strictEqual(r.map.get('c').reaction, null); assert.strictEqual(r.map.get('bb').name, 'b'); // "bb" já era de b
    assert.deepStrictEqual(r.map.get('a-on').aliasArgs['a-on'], ['on']);
  });
  await t('Registo real: handleAuto de comprovativo.js vira automatismo; nomes únicos', () => {
    const { loadRegistry } = require('../src/handlers/registry');
    const reg = loadRegistry(path.join(__dirname, '..'));
    assert.ok(reg.hooks.some((h) => h.name === 'comprovativo:auto'));
    assert.ok(reg.commands.map.size >= 280);
    assert.ok(reg.commands.list.every((c) => Array.isArray(c.alias) && c.category && typeof c.desc === 'string'));
  });

  // ---------- Comprovativos (leitura de SMS) ----------
  await t('SMS M-Pesa e e-Mola: lê referência, valor, destino e data; ignora recebimentos', () => {
    const c = require('../src/services/sms');
    const d = NUM('84', 1); const e = NUM('86', 2);
    const a = c.parse(`Confirmado AB12C3D4EF5. Transferiste 1,250.50MT e a taxa foi de 0.00MT para ${d} - NOME aos 6/11/26 as 12:05 AM. Em caso de duvida, liga 100.`);
    assert.strictEqual(a.servico, 'mpesa'); assert.strictEqual(a.id, 'AB12C3D4EF5'); assert.strictEqual(a.valor, 1250.5); assert.strictEqual(a.destinoNumero, d); assert.strictEqual(a.destinoNome, 'NOME');
    assert.deepStrictEqual([a.quando.dia, a.quando.mes, a.quando.ano, a.quando.h, a.quando.min], [6, 11, 2026, 0, 5]);
    const b = c.parse(`ID da transacao PP260101.1200.R00001. Transferiste 30.00MT para conta ${e}, nome: TITULAR TESTE as 20:18:35 de 06/11/2026. Taxa: 0.00MT.`);
    assert.strictEqual(b.servico, 'emola'); assert.strictEqual(b.id, 'PP260101.1200.R00001'); assert.strictEqual(b.destinoNome, 'TITULAR TESTE'); assert.strictEqual(b.quando.h, 20);
    assert.strictEqual(c.parse('confirmado que pago 25 MT'), null);
    assert.strictEqual(c.parse(`Confirmado AB12C3D4EF5. Recebeste 10.00MT de ${d}`), null);
  });
  await t('Comprovativos: referência única por grupo e decisão só uma vez', () => {
    const store = require('../src/services/comprovativosStore');
    const r = store.criar(db, G1, { valor: 10, referencia: 'ref001', numero: '1' });
    assert.strictEqual(store.porReferencia(db, G1, 'REF001').id, r.id);
    assert.strictEqual(store.porReferencia(db, G2, 'REF001'), null); // outro grupo não vê
    store.decidir(db, G1, r.id, 'aprovado', '2');
    assert.throws(() => store.decidir(db, G1, r.id, 'recusado', '2'), (e) => /já foi tratado/.test(e.userMessage));
  });

  // ---------- Horário e agenda ----------
  await t('Horário e agenda: uma vez por dia, dentro da janela, só com aluguer activo', () => {
    const { due, dueAgenda, localParts } = require('../src/services/groupSchedule');
    rental.alugar(G1, 5);
    const lp = localParts(Date.now(), 'Africa/Maputo');
    const hhmm = `${String(Math.floor(lp.minutes / 60)).padStart(2, '0')}:${String(lp.minutes % 60).padStart(2, '0')}`;
    const cfg = db.groupConfig(G1); cfg.horario.abrir = hhmm; cfg.agenda = [{ id: 1, hhmm, texto: 'x', repetir: true, ultimo: null }];
    assert.deepStrictEqual(due(db, rental, 'Africa/Maputo').map((x) => x.acao), ['abrir']);
    assert.strictEqual(due(db, rental, 'Africa/Maputo').length, 0);
    assert.strictEqual(dueAgenda(db, rental, 'Africa/Maputo').length, 1);
    assert.strictEqual(dueAgenda(db, rental, 'Africa/Maputo').length, 0);
  });


  // ---------- V31.3 ----------
  await t('Token: gera, guarda, roda com 24 h de tolerância e valida em tempo constante', () => {
    const tk = require('../src/services/tokenStore');
    const d2 = new Database(path.join(tmp, 'db-token'), { backupIntervaloMin: 0 }).init();
    const a = tk.gerar(); assert.ok(tk.valido(a)); assert.ok(!tk.valido('curto'));
    tk.definir(d2, a, '1'); assert.ok(tk.verificar(d2, a));
    const b = tk.gerar(); tk.definir(d2, b, '1');
    assert.ok(tk.verificar(d2, b) && tk.verificar(d2, a)); // o anterior ainda vale
    tk.dados(d2).anteriorAte = Date.now() - 1; assert.ok(!tk.verificar(d2, a));
    d2.flush();
    assert.strictEqual(fs.statSync(path.join(tmp, 'db-token', 'token.json')).mode & 0o777, 0o600);
    d2.close();
  });
  await t('Figurinha: foto -> WebP 512x512 (precisa de ffmpeg ou sharp)', async () => {
    const st = require('../src/services/sticker');
    if (!(await st.temFfmpeg())) return; // sem ffmpeg: o comando avisa o utilizador
    const f = path.join(tmp, 'x.jpg');
    require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=300x200', '-frames:v', '1', f]);
    const img = fs.readFileSync(f);
    const w = await st.paraFigurinha(img);
    assert.strictEqual(w.slice(0, 4).toString(), 'RIFF'); assert.strictEqual(w.slice(8, 12).toString(), 'WEBP'); assert.ok(w.length <= 100 * 1024);
    const m = await st.espelhar(img);
    assert.ok(m.length > 0 && !m.equals(img));
  });
  await t('Registo real: 0 placeholders e todos os nomes do menu existem', () => {
    const { loadRegistry } = require('../src/handlers/registry');
    const reg = loadRegistry(path.join(__dirname, '..'));
    assert.ok(reg.commands.list.every((c) => !c.placeholder));
    const menu = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'menu.txt'), 'utf8');
    const nomes = [...new Set([...menu.matchAll(/(?<=^|\s)\.([\p{L}\p{N}_-]+)/gu)].map((x) => x[1]))];
    assert.deepStrictEqual(nomes.filter((n) => !reg.commands.map.has(n)), []);
  });

  // ---------- Sessão: bloqueio de instância dupla ----------
  await t('Bloqueio de sessão: impede duas instâncias e liberta ao sair', async () => {
    const lock = require('../src/services/lock');
    const dir = path.join(tmp, 'auth1');
    const libertar = await lock.adquirir(dir);
    fs.writeFileSync(path.join(dir, '.lock'), JSON.stringify({ pid: process.pid + 1, ts: Date.now() })); // outra instância "viva"
    await assert.rejects(lock.adquirir(dir, { esperaMs: 1200 }), /Outra instância/);
    libertar();
    fs.writeFileSync(path.join(dir, '.lock'), JSON.stringify({ pid: process.pid + 1, ts: Date.now() - 60000 })); // bloqueio antigo = ignorado
    const l2 = await lock.adquirir(dir, { esperaMs: 1200 }); l2();
  });

  // ---------- V31.3 ----------
  await t('Token: gerar, definir, rodar com 24 h de tolerância e validar', () => {
    const tk = require('../src/services/tokenStore');
    const dbt = new Database(path.join(tmp, 'dbt'), { backupIntervaloMin: 0 }).init();
    assert.strictEqual(tk.atual(dbt), null);
    const a = tk.gerar(); assert.ok(tk.valido(a) && !tk.valido('curto'));
    tk.definir(dbt, a, '1'); assert.strictEqual(tk.atual(dbt), a);
    const b = tk.gerar(); tk.definir(dbt, b, '1');
    assert.ok(tk.verificar(dbt, b) && tk.verificar(dbt, a) && !tk.verificar(dbt, tk.gerar()));
    dbt.get('token').dados.anteriorAte = Date.now() - 1; assert.ok(!tk.verificar(dbt, a));
    dbt.flush();
    assert.strictEqual(fs.statSync(path.join(tmp, 'dbt', 'token.json')).mode & 0o777, 0o600);
    dbt.close();
  });
  await t('Figurinha e espelho (ffmpeg ou sharp; ignorado se nenhum existir)', async () => {
    const st = require('../src/services/sticker');
    if (!(await st.temFfmpeg())) { try { require('sharp'); } catch { return; } }
    const { execFileSync } = require('child_process');
    const f = path.join(tmp, 't.jpg');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=120x80', '-frames:v', '1', f]);
    const img = fs.readFileSync(f);
    const w = await st.paraFigurinha(img);
    assert.ok(w.slice(0, 4).toString() === 'RIFF' && w.slice(8, 12).toString() === 'WEBP' && w.length < 100 * 1024);
    assert.ok(!(await st.espelhar(img)).equals(img));
  });
  await t('Registo V31.3: 0 placeholders e sem nomes duplicados', () => {
    const { loadRegistry } = require('../src/handlers/registry');
    const reg = loadRegistry(path.join(__dirname, '..'));
    assert.ok(!reg.commands.list.some((c) => c.placeholder));
    const nomes = reg.commands.list.flatMap((c) => [c.name, ...c.alias]);
    assert.strictEqual(new Set(nomes).size, nomes.length);
  });

  await t('Token: gera, rota com 24 h de tolerância, valida formato e compara em tempo constante', () => {
    const tk = require('../src/services/tokenStore');
    const d0 = new Database(path.join(tmp, 'dbtk'), { backupIntervaloMin: 0 }).init();
    assert.strictEqual(tk.atual(d0), null);
    const a = tk.gerar(); assert.ok(/^sk_[0-9a-f]{48}$/.test(a)); assert.notStrictEqual(a, tk.gerar());
    tk.definir(d0, a, '1'); const b = tk.gerar(); tk.definir(d0, b, '1');
    assert.ok(tk.verificar(d0, b) && tk.verificar(d0, a) && !tk.verificar(d0, 'outro'));
    tk.dados(d0).anteriorAte = Date.now() - 1; assert.ok(!tk.verificar(d0, a)); // anterior expirou
    assert.ok(tk.valido('abcdefghijklmnop') && !tk.valido('curto') && !tk.valido('com espaco 1234567890'));
    assert.strictEqual(fs.statSync(path.join(d0.dir, 'token.json')).mode & 0o777, 0o600);
    d0.close();
  });
  await t('Figurinha e espelho: produzem WebP/JPEG reais (ou avisam que falta sharp/ffmpeg)', async () => {
    const { paraFigurinha, espelhar, temFfmpeg } = require('../src/services/sticker');
    if (!(await temFfmpeg())) { await assert.rejects(paraFigurinha(Buffer.from('x')), /sharp|ffmpeg/); return; }
    const jpg = require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=80x40', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-']);
    const w = await paraFigurinha(jpg);
    assert.strictEqual(w.slice(0, 4).toString(), 'RIFF'); assert.strictEqual(w.slice(8, 12).toString(), 'WEBP'); assert.ok(w.length < 100 * 1024);
    const m = await espelhar(jpg); assert.strictEqual(m[0], 0xff);
    await assert.rejects(paraFigurinha(Buffer.from('isto não é imagem')), (e) => !!e.userMessage);
  });
  await t('Atalhos V31.3: .pb/.px → pagamento, .d → delete, .p → promover, .s → sticker, .f/.fk/.fq → f-quote, .rn → rn', () => {
    const { loadRegistry } = require('../src/handlers/registry');
    const reg = loadRegistry(path.join(__dirname, '..'));
    const m = reg.commands.map;
    for (const [a, c] of [['pb', 'pagamento'], ['px', 'pagamento'], ['d', 'delete'], ['p', 'promover'], ['s', 'sticker'], ['f', 'f-quote'], ['fk', 'f-quote'], ['fq', 'f-quote'], ['renovar', 'rn'], ['embaca', 'embaçar'], ['embacar', 'embaçar'], ['bolsonaro', 'meme'], ['configurartoken', 'settoken'], ['migrartokens', 'migrartoken'], ['f-auto', 'fecharhorario']]) assert.strictEqual(m.get(a)?.name, c, a);
    assert.ok(!reg.commands.list.some((c) => c.placeholder), 'sem placeholders');
  });

  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const falhas = results.filter((r) => !r[0]);
  for (const r of results) console.log(`${r[0] ? '✅' : '❌'} ${r[1]}${r[0] ? '' : ' — ' + r[2]}`);
  console.log(`\n${results.length - falhas.length}/${results.length} testes passaram.`);
  process.exit(falhas.length ? 1 : 0);
})();
