'use strict';
/**
 * Auditoria do SASUKE V31.3 com um WhatsApp SIMULADO (sem rede, sem Baileys).
 * Corre CADA nome do menu pelo caminho real (handler → permissões → aluguer → comando → fila) e verifica as
 * regras novas. Gera AUDITORIA.md. Não substitui o teste com uma conta real.
 */
process.env.SASUKE_OFFLINE = '1';
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const EventEmitter = require('events');

const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sasuke-aud-'));
process.chdir(tmp);
fs.mkdirSync(path.join(tmp, 'assets'), { recursive: true });

let JPG = Buffer.from('imagem-de-teste');
try {
  const cp = require('child_process');
  const f = path.join(tmp, 'teste.jpg');
  cp.execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=96x64', '-frames:v', '1', f], { timeout: 15000 });
  JPG = fs.readFileSync(f);
} catch { /* sem ffmpeg: os testes de figurinha/espelho ficam como "externos" */ }
const TEM_FFMPEG = JPG.length > 20 && JPG[0] === 0xff;
const stub = {
  normalizeMessageContent: (m) => m,
  getContentType: (c) => Object.keys(c).find((k) => k !== 'messageContextInfo'),
  downloadMediaMessage: async () => JPG,
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === '@whiskeysockets/baileys' ? stub : origLoad.call(this, req, ...rest); };

const R = (p) => require(path.join(ROOT, p));
const baseConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const config = {
  ...baseConfig, diversao: { cadeiaMs: 40 }, databaseDir: path.join(tmp, 'database'), authDir: path.join(tmp, 'auth'),
  scheduler: { ...baseConfig.scheduler, intervals: { text: 3, react: 1, image: 3, video: 3, admin: 3, long: 3, default: 3 }, globalGapMs: 1, typing: false, retryBaseMs: 5, dedupeWindowMs: 1 },
  limites: { comandosPorJanela: 100000, janelaMs: 1000 },
};

const { Database } = R('src/database/db');
const { Permissions } = R('src/services/permissions');
const { Rental } = R('src/services/rental');
const { MessageScheduler } = R('src/services/messageScheduler');
const { GroupCache } = R('src/services/groupCache');
const { loadRegistry } = R('src/handlers/registry');
const { createHandler } = R('src/handlers/messageHandler');
const { safeReact } = R('src/utils/safeReact');
const textos = R('src/utils/textos');
const { localParts } = R('src/services/groupSchedule');
const log = R('src/utils/logger');
log.info = () => {}; log.warn = () => {};

// Números de teste construídos em tempo de execução (o código não contém números de pagamento).
const ID = (k) => '2589' + String(k).padStart(8, '0');
const LOCAL = (pref, k) => pref + String(k).padStart(7, '0');
const G = '120363000000000001@g.us'; const G2 = '120363000000000002@g.us'; const G3 = '120363000000000003@g.us';
const J = (n) => n + '@s.whatsapp.net';
const OWNER = J(config.dono.internacional);
const BOT = config.bot.internacional;
const ADM = J(ID(1)); const M2 = J(ID(2)); const M3 = J(ID(3)); const M4 = J(ID(4)); const M5 = J(ID(5));
const N_MPESA = LOCAL('84', 1); const N_EMOLA = LOCAL('86', 2); const N_OUTRO = LOCAL('84', 9); const N_EXTRA = LOCAL('86', 7);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sent = []; const calls = [];
const meta = {
  id: G, subject: 'Grupo Teste', creation: 1700000000, announce: false, restrict: false, desc: 'Descrição de teste',
  participants: [
    { id: OWNER, admin: 'superadmin' }, { id: J(BOT), admin: 'admin' }, { id: ADM, admin: 'admin' },
    { id: M2, admin: null }, { id: M3, admin: null }, { id: M4, admin: null }, { id: M5, admin: null },
  ],
};
let falharReacoes = false;
const sock = {
  user: { id: `${BOT}:1@s.whatsapp.net` }, ev: { on() {}, off() {} },
  async sendMessage(jid, content, opts) {
    if (falharReacoes && content.react) throw new Error('reacção falhou (simulado)');
    sent.push({ jid, content, opts }); return { key: { id: 'M' + sent.length, remoteJid: jid, fromMe: true } };
  },
  async sendPresenceUpdate() {}, async presenceSubscribe() {},
  async groupMetadata() { return meta; },
  async groupParticipantsUpdate(jid, jids, acao) { calls.push(['participants', acao, jids]); return jids.map((j) => ({ status: '200', jid: j })); },
  async groupSettingUpdate(jid, m) { calls.push(['setting', m]); },
  async groupUpdateSubject() {}, async groupUpdateDescription() {},
  async groupInviteCode() { return 'ABC123XYZ789'; }, async groupRevokeInvite() { return 'NEW123XYZ789'; },
  async groupFetchAllParticipating() { return { [G]: meta }; }, async groupLeave() {},
  async profilePictureUrl() { throw new Error('sem foto'); },
};

const db = new Database(config.databaseDir, { backupIntervaloMin: 0 }).init();
const perms = new Permissions(db, config);
const rental = new Rental(db, config);
const registry = loadRegistry(ROOT);
const fakeSessions = {
  list: () => [session.info()], get: (id) => (id === 'sx' ? { id } : null), principal: () => session,
  async add(id) { const e = new EventEmitter(); e.id = id; setTimeout(() => { e.emit('pairing', 'ABCD-1234'); setTimeout(() => e.emit('open'), 30); }, 20); return e; },
  async remove() {}, persist() {}, async stop() {}, async resume() {},
};
const services = { config, db, perms, rental, registry, sessions: fakeSessions };
const session = {
  id: 'principal', services, sock, groups: new GroupCache(), scheduler: new MessageScheduler(config.scheduler), status: 'online',
  info() { return { id: 'principal', estado: 'online', numero: BOT, fila: { pendentes: 0 } }; },
};
session.scheduler.setSocket(sock); session.scheduler.setReady(true);
const handler = createHandler({ ...services, session });

async function settle() {
  for (let i = 0; i < 600; i++) {
    const s = session.scheduler;
    const quieto = () => s.stats().pendentes === 0 && s.active === 0 && [...s.chats.values()].every((c) => !c.running);
    if (quieto()) { await sleep(10); if (quieto()) return; }
    await sleep(8);
  }
}

let seq = 0;
async function enviar({ jid = G, from = OWNER, text = '', content, mentioned, quoted, id }) {
  id = id || 'T' + (++seq);
  const ci = {};
  if (mentioned) ci.mentionedJid = mentioned;
  if (quoted) { ci.stanzaId = 'Q1'; ci.participant = quoted.sender || M2; ci.quotedMessage = { conversation: quoted.text || 'texto citado' }; }
  const message = content || { extendedTextMessage: { text, contextInfo: ci } };
  const msg = { key: { remoteJid: jid, id, participant: jid.endsWith('@g.us') ? from : undefined, fromMe: false }, pushName: 'Tester', messageTimestamp: Math.floor(Date.now() / 1000), message };
  const ini = sent.length;
  await handler({ type: 'notify', messages: [msg] });
  await settle();
  const novos = sent.slice(ini);
  const ordem = novos.map((s) => (s.content.react?.key.id === id ? 'R' : 'T'));
  const reacts = novos.filter((s) => s.content.react?.key.id === id).map((s) => s.content.react.text);
  const respostas = novos.filter((s) => !s.content.react).map((s) => s.content.text || s.content.caption || (s.content.delete ? '(apagou)' : '(media)'));
  return { id, reacts, final: reacts[reacts.length - 1], respostas, novos, ordem };
}

const EXTERNO = /sharp|ffmpeg|indispon|Depend[eê]ncia|configurad|Nenhuma fonte|n[aã]o encontrada|resolver|N[aã]o h[aá] ficheiros/i;
const REGRA = /Só observo|dados incompletos/i;
const resultados = new Map(); const extras = []; const checks = [];
const chk = (nome, ok, det = '') => checks.push({ nome, ok: !!ok, det });

async function cmd(nome, args = '', opts = {}) {
  const r = await enviar({ text: `.${nome}${args ? ' ' + args : ''}`, ...opts });
  const c = registry.commands.map.get(nome);
  const txt = r.respostas.join(' | ');
  let estado; let nota = '';
  if (c?.placeholder && /ainda não tem função definida/.test(txt)) estado = 'PLACEHOLDER';
  else if (r.final === '❌' && EXTERNO.test(txt)) { estado = 'OK-EXTERNO'; nota = 'depende de fonte externa/configuração (não testável offline); falha tratada'; }
  else if (r.final === '❌' && REGRA.test(txt)) { estado = 'OK-REGRA'; nota = 'recusa por regra de segurança (esperado)'; }
  else if (r.final === '❌' || r.respostas.length === 0 || /Erro ao executar/.test(txt)) { estado = 'FALHA'; nota = `reacção ${r.final || 'nenhuma'} · ${txt.slice(0, 140)}`; }
  else estado = 'OK';
  if (!opts.extra && !resultados.has(nome)) resultados.set(nome, { estado, nota });
  else extras.push({ nome: `.${nome} ${args}`.trim(), estado, nota });
  return r;
}

const m = (...j) => ({ mentioned: j });
const q = { quoted: { sender: M2, text: 'olá' } };
const SMSM = (id, dest, valor = '25.00', antigo = 0) => {
  const lp = localParts(Date.now() - antigo * 60000, config.fusoHorario); const [y, mo, d] = lp.date.split('-');
  const h24 = Math.floor(lp.minutes / 60); const mi = String(lp.minutes % 60).padStart(2, '0'); const h12 = h24 % 12 || 12;
  return `Confirmado ${id}. Transferiste ${valor}MT e a taxa foi de 0.00MT para ${dest} - TITULAR aos ${Number(d)}/${Number(mo)}/${y.slice(2)} as ${h12}:${mi} ${h24 >= 12 ? 'PM' : 'AM'}. O teu novo saldo M-Pesa e de 5.00MT.`;
};
const SMSE = (id, dest, antigo = 0) => {
  const lp = localParts(Date.now() - antigo * 60000, config.fusoHorario); const [y, mo, d] = lp.date.split('-');
  return `ID da transacao ${id}. Transferiste 30.00MT para conta ${dest}, nome: TITULAR TESTE as ${String(Math.floor(lp.minutes / 60)).padStart(2, '0')}:${String(lp.minutes % 60).padStart(2, '0')}:35 de ${d}/${mo}/${y}. Taxa: 0.00MT. O saldo da tua conta e 52.00MT. Conteudo: 1.`;
};

// argumentos por comando principal
const ARGS = {
  ban: ['@t', m(M4)], kick: ['@t', m(M3)], add: [N_OUTRO], promover: ['@t', m(M2)], rebaixar: ['@t', m(M2)], mute: ['@t', m(M3)], unmute: ['@t', m(M3)], unban: ['@t', m(M4)],
  abrirhorario: ['07:00'], fecharhorario: ['22:00'], nome: ['Novo Nome'], desc: ['Nova descrição'],
  boasvindas: ['on'], nanobemvindo: ['Olá {nome}, bem-vindo a {grupo}'], saidas: ['on'], nanosaida: ['Adeus {nome}'], autoresposta: ['on'],
  hidetag: ['olá a todos'], marcar: ['atenção'], delete: ['', q], limpar: ['2'], dectetor: ['on'], revelar: ['', q],
  nano: ['on'], nanoadd: ['oi | olá {nome}'], nanodel: ['1'],
  antilink: ['on'], antilinkhard: ['on'], anticanal: ['on'], antifoto: ['on'], antivideo: ['on'], antiaudio: ['on'], antisticker: ['on'], antidoc: ['on'], antiviewonce: ['on'], antipalavrao: ['on'], antidelete: ['on'], automover: ['on'],
  antifake: ['on 258'], antiflood: ['on 6 8'], maxavisos: ['5'],
  addmpesa: [`${N_MPESA} Titular`], addemola: [`${N_EMOLA} Titular`], antiburlador: ['on'],
  liberar: ['ban'], clientes: [`add ${N_OUTRO}`], modolivre: ['on'],
  alugar: ['30'], tirardias: ['1'], conectar: [ID(900)], desconectar: ['sx'],
  anime: ['Naruto Uzumaki'], dado: ['20'], '8ball': ['vou ganhar?'], beijar: ['', m(M2)], abraçar: ['', m(M2)], socar: ['', m(M2)], 'style-menu': ['1'], ship: ['', m(M2, M3)],
  settabela: ['Tabela de teste'], setpagamento: ['Pagamento de teste'], setmegas: ['Megas de teste'], setcontas: ['Contas de teste'], setcarteira: ['Carteira de teste'], setcompra: ['Compra de teste'], setloja: ['Loja de teste'],
  comprovativo: ['50 REFTESTE01'], 'auto-comprovativo': ['on'], verificarsms: [SMSM('AB12C3D4EF5', N_MPESA)], verificarrecibo: ['REFTESTE01'], debugrecibo: ['REFTESTE01'],
  cep: ['01001000'], extrair: ['ver https://exemplo.pt e mail@exemplo.pt'], 'g-search': ['sasuke'], 'gerar-link': [`${ID(7)} olá`], calcula: ['2+2*3'],
  'enviar-texto': ['olá'], 'enviar-reacoes': ['👍'], 'enviar-imagem-de-url': ['https://exemplo.invalid/a.jpg'], 'enviar-imagem-de-buffer': ['https://exemplo.invalid/a.jpg'], 'enviar-video-de-url': ['https://exemplo.invalid/a.mp4'],
  'enviar-video-de-buffer': ['https://exemplo.invalid/a.mp4'], 'enviar-gif-de-url': ['https://exemplo.invalid/a.mp4'], 'enviar-gif-de-buffer': ['https://exemplo.invalid/a.mp4'],
  sticker: ['', { content: { imageMessage: { caption: '.s' } } }], mirror: ['', { content: { imageMessage: { caption: '.mirror' } } }],
  upload: ['anime/teste', { content: { imageMessage: { caption: '.upload anime/teste' } } }],
  embaçar: ['', m(M2)], cadeia: ['', m(M2)], ad: ['preciso de ajuda'], 'f-quote': ['', q], depositar: ['100Mb'], addsaldo: ['@t 100', m(M2)], limparrestanas: ['confirmar'],
  token: ['', { jid: OWNER }], settoken: ['tokendeteste1234567890', { jid: OWNER }], migrartoken: ['', { jid: OWNER }],
  rn: ['10'], 'ban-senha': ['@t', m(M5)], anticoncorrencia: ['on'],
  grupo: ['info'], periodoremocao: ['30'], agendar: ['08:00 Bom dia'], anularcompra: ['1'], ativarcompras: ['on'], limparcompras: ['confirmar'], addtelefone: [`${N_EXTRA} Nome`], deltelefone: ['1'],
};
const PRIMEIRO = [
  'settabela', 'setpagamento', 'setmegas', 'setcontas', 'setcarteira', 'setcompra', 'setloja', 'addmpesa', 'addemola', 'compra', 'comprovativo', 'nanoadd',
  'ban', 'kick', 'add', 'promover', 'rebaixar', 'mute', 'unmute', 'banlist', 'unban', 'admins', 'membros', 'online',
];
const ULTIMO = ['anular'];

(async () => {
  rental.alugar(G, 30, 'auditoria', 'Grupo Teste');
  db.groupRecord(G);
  const nomes = [...new Set([...fs.readFileSync(path.join(ROOT, 'src/data/menu.txt'), 'utf8').matchAll(/(?<=^|\s)\.([\p{L}\p{N}_-]+)/gu)].map((x) => x[1]))];

  const correr = async (nome) => {
    const c = registry.commands.map.get(nome);
    if (!c) { resultados.set(nome, { estado: 'FALHA', nota: 'sem comando registado' }); return; }
    const a = ARGS[c.name] || [''];
    await cmd(nome, a[0], a[1] || {});
  };

  await enviar({ text: '.compra pedir 5GB', from: M5 });
  for (const n of PRIMEIRO) await correr(n);
  const canon = registry.commands.list.map((c) => c.name).filter((n) => !PRIMEIRO.includes(n) && !ULTIMO.includes(n));
  for (const n of canon) await correr(n);
  for (const n of nomes) { if (!resultados.has(n) && !ULTIMO.includes(n)) await correr(n); }
  await cmd('bangp', '', { extra: true });

  // ---------- 1. Estrutura e regras gerais ----------
  chk(`todos os ${nomes.length} nomes do menu têm comando`, nomes.every((n) => registry.commands.map.has(n)));
  chk('"Comandos: 280+" é verdade (nomes registados ≥ 280)', registry.commands.map.size >= 280, `nomes=${registry.commands.map.size}`);
  chk('nenhum comando exige reaction (name/run obrigatórios; alias/desc/category normalizados)', registry.commands.list.every((c) => typeof c.run === 'function' && Array.isArray(c.alias) && typeof c.desc === 'string' && typeof c.category === 'string'));
  chk('auto-comprovativo não é ficheiro separado (handleAuto dentro de comprovativo.js)', !fs.existsSync(path.join(ROOT, 'src/protections/comprovativo.js')) && registry.hooks.some((h) => h.name === 'comprovativo:auto'));

  const varre = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'assets', 'auth', 'database', 'logs', 'comprovativos', '.git'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) varre(p, out); else if (/\.(js|md|json|txt)$/.test(e.name) && e.name !== 'config.json' && e.name !== 'AUDITORIA.md') out.push(p);
    }
    return out;
  };
  const RE_NUM = new RegExp('(?<!\\d)(?:258)?8[2-7]\\d{7}(?!\\d)');
  const achados = varre(ROOT).filter((f) => RE_NUM.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  chk('nenhum número de pagamento (M-Pesa/e-Mola) fixo no código', achados.length === 0, achados.join(', '));

  // Estado limpo para os testes de comportamento
  perms.resetGrupo(G);
  db.groupConfig(G).mutados = [];
  db.groupConfig(G).protecoes = {};
  db.save('configuracoes');
  const { setProt } = R('src/services/protecao');

  // ---------- 2. Reacção opcional e segura ----------
  const rA = await enviar({ text: '.dado 20' });
  chk('a reacção vem DEPOIS da resposta do comando', rA.ordem.indexOf('R') > rA.ordem.indexOf('T') && rA.ordem.indexOf('T') >= 0, rA.ordem.join(''));
  registry.commands.map.set('semreacao', { name: 'semreacao', alias: [], desc: '', category: 'X', reaction: null, level: 'membro', run: async (c) => c.reply('ok') });
  const rB = await enviar({ text: '.semreacao' });
  registry.commands.map.delete('semreacao');
  chk('comando sem reaction não reage e não dá erro', rB.reacts.length === 0 && rB.respostas.length === 1);
  const antes = sent.length;
  for (const e of ['abc', '😀😀', '', '   ', null, undefined, 123, 'x'.repeat(40), '👍 👍']) await safeReact(sock, { key: { remoteJid: G, id: 'Z' } }, e);
  chk('safeReact ignora emoji inválido (duplo, texto, vazio, não-string) sem erro', sent.length === antes);
  await safeReact(sock, { key: { remoteJid: G, id: 'Z' } }, '👍');
  chk('safeReact envia 1 emoji válido', sent.length === antes + 1);
  falharReacoes = true;
  const rC = await enviar({ text: '.moeda' });
  falharReacoes = false;
  chk('se a reacção falhar, o comando continua e o bot não quebra', rC.respostas.some((x) => /CARA|COROA/.test(x)));
  const rD = await enviar({ text: '.ban', from: M3 });
  chk('sem permissão: avisa e reage ❌ sem quebrar', rD.final === '❌' && rD.respostas.some((x) => /permiss/i.test(x)));

  // ---------- 3. Menu exacto ----------
  const MENU = fs.readFileSync(path.join(ROOT, 'src/data/menu.txt'), 'utf8').replace(/\r/g, '').trimEnd();
  const mA = await enviar({ text: '.menu' });
  chk('.menu sem foto: erro explícito + texto EXACTO do menu', mA.respostas.some((x) => /SEM imagem/.test(x)) && mA.respostas.includes(MENU));
  fs.writeFileSync(path.join(tmp, 'assets', 'sasuke.jpg'), Buffer.from('foto'));
  const mB = await enviar({ text: '.menu' });
  const img = mB.novos.find((s) => s.content.image);
  const txt = mB.novos.find((s) => s.content.text && !s.content.react && s.content.text.startsWith('🙋'));
  chk('.menu com foto: legenda + texto juntos formam o texto EXACTO', !!img && !!txt && `${img.content.caption}\n\n${txt.content.text}` === MENU);
  const mC = await enviar({ text: '.help' });
  chk('.help é atalho do .menu', mC.novos.some((s) => s.content.image || (s.content.text || '').startsWith('🙋')));

  // ---------- 4. Pagamento por grupo ----------
  const p1 = await enviar({ jid: G2, from: OWNER, text: '.pagamento' });
  chk('.pagamento sem configuração: mensagem pedida', p1.respostas.includes('Este grupo ainda não configurou pagamento. Admin usa .setpagamento'));
  await enviar({ jid: G2, from: OWNER, text: '.setpagamento Pagamento do grupo B' });
  await enviar({ jid: G2, from: OWNER, text: `.addmpesa ${LOCAL('85', 5)} Outro` });
  const pa = db.get('pagamentos').grupos[G]; const pb = db.get('pagamentos').grupos[G2];
  chk('pagamento do grupo A e do grupo B ficam separados', pa?.pagamento?.texto !== pb?.pagamento?.texto && pa.mpesa.length === 1 && pb.mpesa.length === 1 && pa.mpesa[0].numero !== pb.mpesa[0].numero);

  // ---------- 5. Comprovativos ----------
  await cmd('auto-comprovativo', 'off', { extra: true });
  const off0 = await enviar({ from: M4, text: SMSM('ZZ11AA22BB3', N_MPESA) });
  chk('auto-comprovativo desligado não gera o cartão de comprovativo', !off0.respostas.some((x) => /COMPROVATIVO DETECTADO|𝑪𝑶𝑴𝑷𝑹𝑶𝑽𝑨𝑻𝑰𝑽𝑶/.test(x)));
  await cmd('auto-comprovativo', 'on', { extra: true });
  const c1 = await enviar({ from: M4, text: SMSM('AB12C3D4EF5', N_MPESA) });
  chk('M-Pesa: cartão com chave, valor e destino validado', c1.respostas.some((x) => /AB12C3D4EF5/.test(x) && /25\.00 MT/.test(x) && /Destino validado/.test(x)), c1.respostas.join('|').slice(0, 160));
  chk('M-Pesa: notifica os admins do grupo (menção) e ensina aprovar/recusar', c1.novos.some((s) => (s.content.mentions || []).includes(ADM) && /comprovativo aprovar/.test(s.content.text || '')));
  chk('M-Pesa: aviso ao cliente (pendente, admin confirma)', c1.respostas.some((x) => /administrador confirma o pagamento/.test(x)));
  const rec1 = db.get('comprovativos').grupos[G].registos.find((r) => r.referencia === 'AB12C3D4EF5');
  chk('fica em database/comprovativos.json como PENDENTE (nunca aprovado sozinho)', rec1 && rec1.estado === 'pendente' && rec1.operadora === 'mpesa');
  const c2 = await enviar({ from: M4, text: SMSM('AB12C3D4EF5', N_MPESA) });
  chk('referência repetida: sinalizada e sem novo registo', c2.respostas.some((x) => /JÁ REGISTADA/.test(x)) && db.get('comprovativos').grupos[G].registos.filter((r) => r.referencia === 'AB12C3D4EF5').length === 1);
  const c3 = await enviar({ from: M4, text: SMSM('CD45E6F7GH8', N_OUTRO) });
  chk('destino fora dos números do grupo: sinalizado', c3.respostas.some((x) => /NÃO coincide/.test(x)));
  const c4 = await enviar({ from: M4, text: SMSM('EF78G9H0IJ1', N_MPESA, '25.00', 300) });
  chk('comprovativo antigo: sinalizado', c4.respostas.some((x) => /antigo/.test(x)));
  const e1 = await enviar({ from: M4, text: SMSE('PP260101.1200.R00001', N_EMOLA) });
  chk('e-Mola: cartão com operadora, chave, valor e destino validado', e1.respostas.some((x) => /e-Mola/.test(x) && /PP260101\.1200\.R00001/.test(x) && /Destino validado/.test(x)));
  const e2 = await enviar({ from: M4, text: SMSE('PP260101.1300.R00002', N_EXTRA) });
  chk('e-Mola: destino fora dos números e-Mola: sinalizado', e2.respostas.some((x) => /NÃO coincide com nenhum número e-Mola/.test(x)));
  chk('mensagens de admins são ignoradas', (await enviar({ from: ADM, text: SMSM('KL23M4N5OP6', N_MPESA) })).respostas.length === 0);
  chk('texto normal não é comprovativo', (await enviar({ from: M4, text: 'confirmado, vou pagar 25 MT amanhã' })).respostas.length === 0);
  const f1 = await enviar({ from: M4, content: { imageMessage: { caption: '.comprovativo 75 REFFOTO01' } } });
  const recF = db.get('comprovativos').grupos[G].registos.find((r) => r.referencia === 'REFFOTO01');
  chk('.comprovativo VALOR REFERENCIA + foto: regista e guarda a foto em comprovativos/', recF && recF.foto && fs.existsSync(path.join(tmp, recF.foto)), JSON.stringify(f1.respostas).slice(0, 120));
  const d1 = await enviar({ from: M4, text: '.comprovativo 75 REFFOTO01' });
  chk('.comprovativo: não duplica a mesma referência', d1.final === '❌' && d1.respostas.some((x) => /já foi registada/.test(x)));
  const pe = await enviar({ from: ADM, text: '.comprovativo pendentes' });
  chk('.comprovativo pendentes (admin) lista os pendentes', pe.respostas.some((x) => /AB12C3D4EF5/.test(x)));
  chk('membro não vê pendentes', (await enviar({ from: M4, text: '.comprovativo pendentes' })).final === '❌');
  const ap = await enviar({ from: ADM, text: `.comprovativo aprovar ${rec1.id}` });
  chk('.comprovativo aprovar ID (só admin) aprova', ap.final !== '❌' && db.get('comprovativos').grupos[G].registos.find((r) => r.id === rec1.id).estado === 'aprovado', `final=${ap.final} resp=${JSON.stringify(ap.respostas)} rec=${JSON.stringify(rec1)}`);
  const rc = await enviar({ from: ADM, text: `.comprovativo recusar ${recF.id} sem pagamento` });
  chk('.comprovativo recusar ID recusa com motivo', rc.final !== '❌' && db.get('comprovativos').grupos[G].registos.find((r) => r.id === recF.id).estado === 'recusado');
  chk('não aprova duas vezes', (await enviar({ from: ADM, text: `.comprovativo aprovar ${rec1.id}` })).final === '❌');

  // ---------- 6. Protecções ----------
  db.groupConfig(G).mutados = [];
  for (const p of ['antilink', 'antipalavrao', 'antifoto', 'antiflood', 'antidelete']) setProt(db, G, p, p === 'antiflood' ? { ativo: true, maxMsgs: 6, janelaSeg: 8 } : { ativo: true });
  setProt(db, G, 'antiburlador', { ativo: false });
  const apagou = (r) => r.novos.some((s) => s.content.delete);
  const t1 = await enviar({ from: M3, text: 'vejam chat.whatsapp.com/ABCDEFGHIJKL' });
  chk('antilink apaga e avisa', apagou(t1) && t1.respostas.some((x) => /Aviso 1\/5/.test(x)));
  chk('antipalavrao apaga palavrão', apagou(await enviar({ from: M5, text: 'que merda' })));
  chk('antifoto apaga imagem', apagou(await enviar({ from: M5, content: { imageMessage: { caption: 'foto' } } })));
  chk('administradores são isentos', !apagou(await enviar({ from: ADM, text: 'chat.whatsapp.com/ABCDEFGHIJKL' })));
  for (let i = 0; i < 8; i++) await enviar({ from: M2, text: 'spam ' + i });
  chk('antiflood reage a rajadas', sent.some((s) => /flood/.test(s.content.text || '')));
  await cmd('mute', '@t', { ...m(M4), extra: true });
  chk('mute apaga mensagens de silenciados', apagou(await enviar({ from: M4, text: 'olá a todos' })));
  await cmd('unmute', '@t', { ...m(M4), extra: true });
  await cmd('nanoadd', 'oi | olá {nome}', { extra: true });
  chk('nano responde ao gatilho', (await enviar({ from: M5, text: 'oi pessoal' })).respostas.some((x) => /^olá/.test(x)));
  await enviar({ from: ADM, text: 'mensagem secreta', id: 'ORIG1' });
  const ad = await enviar({ from: ADM, content: { protocolMessage: { type: 0, key: { id: 'ORIG1' } } } });
  chk('antidelete repõe mensagem apagada (já recebida)', ad.novos.some((s) => s.content.forward) || ad.respostas.some((x) => /apagou uma mensagem/.test(x)));

  // ---------- 7. Gestão (inactivos, agenda) ----------
  db.groupRecord(G).primeiraVez = Date.now() - 60 * 86400000;
  db.groupConfig(G).inatividadeDias = 30;
  const r5a = await enviar({ from: OWNER, text: '.remover5' });
  chk('.remover5 mostra candidatos antes de remover', r5a.respostas.some((x) => /Seriam removidos|Não encontrei/.test(x)));
  calls.length = 0;
  await enviar({ from: OWNER, text: '.remover5 confirmar' });
  const removidos = calls.filter((c) => c[0] === 'participants' && c[1] === 'remove').flatMap((c) => c[2]);
  chk('.remover5 confirmar remove só membros comuns (nunca admins, dono nem bot)', removidos.every((j) => ![OWNER, J(BOT), ADM].includes(j)) && removidos.length <= 5);
  const { dueAgenda } = R('src/services/groupSchedule');
  const cfgG = db.groupConfig(G);
  const lp = localParts(Date.now(), config.fusoHorario);
  cfgG.agenda = [{ id: 1, hhmm: `${String(Math.floor(lp.minutes / 60)).padStart(2, '0')}:${String(lp.minutes % 60).padStart(2, '0')}`, texto: 'Bom dia', repetir: false, ultimo: null }];
  const dd = dueAgenda(db, rental, config.fusoHorario);
  chk('.agendar: mensagem devida aparece uma vez e a "única" é removida', dd.length === 1 && dd[0].texto === 'Bom dia' && cfgG.agenda.length === 0 && dueAgenda(db, rental, config.fusoHorario).length === 0);

  setProt(db, G, 'antifake', { ativo: true, prefixos: ['258'] });

  // ---------- 8. Eventos de entrada/saída ----------
  const participantes = R('src/handlers/events/participants');
  const env = { sock, scheduler: session.scheduler, db, rental, groups: session.groups, config };
  db.groupConfig(G).boasvindasTexto = null; db.groupConfig(G).saidaTexto = null;
  let i0 = sent.length;
  await participantes.run(env, { id: G, action: 'add', participants: [J(ID(50))], author: OWNER }); await settle();
  chk('boas-vindas enviadas com menção', sent.slice(i0).some((s) => /Bem-vindo\(a\), @/.test(s.content.text || s.content.caption || '')));
  i0 = sent.length;
  await participantes.run(env, { id: G, action: 'remove', participants: [J(ID(50))], author: J(ID(50)) }); await settle();
  chk('despedida (saída voluntária)', sent.slice(i0).some((s) => /vontade própria/.test(s.content.text || s.content.caption || '')));
  calls.length = 0;
  await participantes.run(env, { id: G, action: 'add', participants: [J('27123456789')], author: OWNER }); await settle();
  chk('antifake remove números fora do +258', calls.some((c) => c[0] === 'participants' && c[1] === 'remove'));

  // ---------- 9. Aluguer: avisos com o link do canal ----------
  const link = config.canal.link;
  chk('link do canal está configurado', /^https:\/\/whatsapp\.com\/channel\//.test(link));
  chk('.canal manda o link (também em grupo sem aluguer)', (await enviar({ jid: G3, from: M3, text: '.canal' })).respostas.some((x) => x.includes(link)));
  const nr = await enviar({ jid: G3, from: M3, text: '.tabela' });
  chk('grupo nunca alugado: aviso com o link do canal', nr.respostas.some((x) => /não tem aluguer activo/.test(x) && x.includes(link)));
  rental.alugar(G2, 3, 'teste'); const r2 = rental.get(G2);
  r2.inicio = Date.now() - 2 * 86400000; r2.expira = Date.now() + 20 * 3600000;
  chk('falta 1 dia: detectado uma vez', rental.umDia().some((r) => r.gid === G2) && (rental.markUmDia(G2), !rental.umDia().some((r) => r.gid === G2)));
  chk('texto "Falta 1 dia" exacto', textos.aluguelUmDia(config) === `Falta 1 dia, renova no canal: ${link}`);
  r2.expira = Date.now() - 1000; rental.tick();
  const ex = await enviar({ jid: G2, from: M3, text: '.tabela' });
  chk('expirou: texto exacto e comandos bloqueados', ex.respostas.includes(`Aluguer expirado, entra no canal para renovar: ${link}`) && !ex.respostas.some((x) => /TABELA/.test(x)));
  chk('expirado: .menu continua a funcionar (free)', (await enviar({ jid: G2, from: M3, text: '.menu' })).novos.length > 0);
  rental.alugar(G2, 5, 'teste');
  chk('renovar volta a desbloquear', (await enviar({ jid: G2, from: M3, text: '.tabela' })).respostas.some((x) => /ainda não configurou/.test(x)));


  const link0 = config.canal.link;
  // ---------- 10. V31.3: comandos que eram placeholders ----------
  for (const p of ['antiflood', 'antifoto', 'antilink', 'antipalavrao']) setProt(db, G, p, { ativo: false }); // as protecções de teste da secção 6 já cumpriram o papel
  const { temFfmpeg } = R('src/services/sticker');
  const ff = await temFfmpeg();
  chk('0 placeholders: nenhum comando "sem função"', !registry.commands.list.some((c) => c.placeholder) && !sent.some((s) => /ainda não tem função|sem função/i.test(s.content.text || s.content.caption || '')));
  // picos
  const pc0 = await enviar({ from: M3, text: '.picos' });
  chk('.picos sem compras: "Ninguém comprou ainda"', pc0.respostas.includes('Ninguém comprou ainda'));
  await enviar({ from: M5, text: '.compra pedir 5GB' });
  const pedido = db.get('compras').grupos[G].registos.find((r) => r.numero === ID(5));
  await enviar({ from: OWNER, text: `.compra confirmar ${pedido.id}` });
  const pc1 = await enviar({ from: M3, text: '.picos' });
  chk('.picos mostra o ranking (compras.json confirmadas)', pc1.respostas.some((x) => x.includes('@' + ID(5)) && /1 compra/.test(x)));
  const pv = await enviar({ from: ADM, text: '.picospv' });
  chk('.picospv envia o ranking no privado do admin', pv.novos.some((s) => s.jid === ADM && /PICOS|Ninguém/.test(s.content.text || '')));
  // semcompra / faltacompra
  chk('.semcompra lista quem não comprou (sem admins)', (await enviar({ from: ADM, text: '.semcompra' })).respostas.some((x) => /Sem compras/.test(x) && !x.includes(ID(5))));
  // depositar / rec / aprovar sem valor
  const dp = await enviar({ from: M2, text: '.depositar 100Mb' });
  const rd = db.get('comprovativos').grupos[G].registos.find((r) => r.tipo === 'deposito' && r.numero === ID(2));
  chk('.depositar regista PENDENTE em comprovativos.json e avisa os admins', rd && rd.estado === 'pendente' && rd.referencia === 'DEP' + rd.id && dp.novos.some((s) => (s.content.mentions || []).includes(ADM) && /comprovativo aprovar/.test(s.content.text || '')));
  chk('.faltacompra mostra o depósito pendente', (await enviar({ from: ADM, text: '.faltacompra' })).respostas.some((x) => x.includes(`comprovativo #${rd.id}`)));
  chk('.rec mostra o recibo do depósito', (await enviar({ from: M2, text: '.rec' })).respostas.some((x) => /RECIBO/.test(x) && /100Mb/.test(x)));
  chk('.rec sem comprovativos avisa', (await enviar({ from: M3, text: '.rec' })).respostas.some((x) => /Ainda não tens comprovativos/.test(x)));
  chk('aprovar depósito (sem valor) funciona e .relatorio não quebra', (await enviar({ from: ADM, text: `.comprovativo aprovar ${rd.id}` })).final !== '❌' && (await enviar({ from: ADM, text: '.relatorio' })).respostas.some((x) => /RELATÓRIO/.test(x)));
  // carteira
  await enviar({ from: OWNER, text: '.addsaldo @t 100', mentioned: [M3] });
  chk('.addsaldo adiciona à carteira do cliente', db.get('pagamentos').grupos[G].saldos[ID(3)]?.saldo.MT === 100);
  chk('.saldo mostra a carteira do grupo', (await enviar({ from: M3, text: '.saldo' })).respostas.some((x) => /Carteira do grupo: 100 MT/.test(x)));
  chk('.restanas lista saldos', (await enviar({ from: ADM, text: '.restanas' })).respostas.some((x) => x.includes('@' + ID(3)) && /100 MT/.test(x)));
  const neg = await enviar({ from: OWNER, text: '.addsaldo @t -500', mentioned: [M3] });
  chk('.addsaldo não deixa o saldo ficar negativo', neg.final === '❌' && db.get('pagamentos').grupos[G].saldos[ID(3)].saldo.MT === 100);
  await enviar({ from: OWNER, text: '.limparrestanas confirmar' });
  chk('.limparrestanas confirmar zera os saldos', Object.keys(db.get('pagamentos').grupos[G].saldos).length === 0);
  // chave / pagamento
  chk('.chave (admin) mostra o pagamento configurado', (await enviar({ from: ADM, text: '.chave' })).respostas.some((x) => x.includes(N_MPESA)));
  rental.alugar(G3, 5, 'teste');
  chk('.chave sem configuração manda configurar', (await enviar({ jid: G3, from: OWNER, text: '.chave' })).respostas.some((x) => /ainda não configurou pagamento/.test(x)));
  chk('.chave: membro sem permissão', (await enviar({ from: M3, text: '.chave' })).final === '❌');
  chk('.pb e .px são atalhos de .pagamento', (await enviar({ from: M3, text: '.pb' })).respostas.some((x) => /PAGAMENTO/.test(x)) && (await enviar({ from: M3, text: '.px' })).respostas.some((x) => /PAGAMENTO/.test(x)));
  // moderação
  await enviar({ from: OWNER, text: '.ban-senha @t', mentioned: [M5] });
  chk('.ban-senha bane e guarda o motivo', /senha/.test(db.groupRecord(G).banidos?.[ID(5)]?.motivo || ''));
  // grupos autorizados
  await enviar({ from: OWNER, text: '.addgp' });
  chk('.addgp autoriza o grupo', db.groupRecord(G).autorizado === true);
  config.soGruposAutorizados = true;
  const au1 = await enviar({ jid: G3, from: M3, text: '.canal' }); const au2 = await enviar({ from: M3, text: '.canal' });
  config.soGruposAutorizados = false;
  chk('modo "só grupos autorizados": ignora os outros e serve os autorizados', au1.respostas.length === 0 && au2.respostas.some((x) => x.includes(link0)));
  // renovar
  chk('.rn (membro) mostra como renovar com o link do canal', (await enviar({ from: M3, text: '.rn' })).respostas.some((x) => x.includes(link0)));
  const dias0 = rental.info(G).diasRestantes; await enviar({ from: OWNER, text: '.renovar 10' });
  chk('.renovar/.rn (dono) renova o aluguer', rental.info(G).diasRestantes >= dias0 + 9);
  // anti-concorrência
  setProt(db, G, 'anticoncorrencia', { ativo: true });
  chk('anticoncorrencia apaga anúncio de venda com contacto', apagou(await enviar({ from: M3, text: `vendo megas baratos contacto ${N_OUTRO}` })));
  chk('anticoncorrencia não apanha clientes', !apagou(await enviar({ from: M4, text: `preciso de megas para o ${N_OUTRO}` })));
  setProt(db, G, 'anticoncorrencia', { ativo: false });
  // diversão e informação
  const cj = await enviar({ from: M3, text: '.cadeia @t', mentioned: [M2] }); await sleep(250); await settle();
  chk('.cadeia prende e depois solta', cj.respostas.some((x) => /foi preso/.test(x)) && sent.some((s) => /foi solto/.test(s.content.text || '')));
  chk('.embaça/.embacar marcam a pessoa', (await enviar({ from: M3, text: '.embacar @t', mentioned: [M2] })).novos.some((s) => /embaçou 😶‍🌫️/.test(s.content.text || '') && (s.content.mentions || []).includes(M2)));
  const fq = await enviar({ from: M3, text: '.fq', quoted: { sender: M4, text: 'frase verdadeira' } });
  chk('.f-quote cita a mensagem real com o autor verdadeiro (nunca outro)', fq.novos.some((s) => /frase verdadeira/.test(s.content.text || '') && (s.content.mentions || []).length === 1 && s.content.mentions[0] === M4));
  chk('.f só cita as palavras de quem o usa', (await enviar({ from: M3, text: '.f olá mundo', mentioned: [M4] })).novos.some((s) => /olá mundo/.test(s.content.text || '') && s.content.mentions[0] === M3));
  const adr = (await enviar({ from: M3, text: '.ad preciso de ajuda' }));
  chk('.ad chama os admins; cooldown evita spam', adr.novos.some((s) => (s.content.mentions || []).includes(ADM)) && (await enviar({ from: M3, text: '.ad outra vez' })).final === '❌');
  chk('.app mostra informação e o canal', (await enviar({ from: M3, text: '.app' })).respostas.some((x) => x.includes(link0)));
  chk('.tempo mostra uptime e hora de Maputo', (await enviar({ from: M3, text: '.tempo' })).respostas.some((x) => /Uptime/.test(x) && /Maputo/.test(x)));
  chk('.ti mostra versão e dono', (await enviar({ from: M3, text: '.ti' })).respostas.some((x) => /31\.3/.test(x) && /Leo/.test(x)));
  chk('.buttons mostra o painel', (await enviar({ from: M3, text: '.buttons' })).respostas.some((x) => /\.menu/.test(x)));
  // token (dono, só no privado)
  const tk1 = await enviar({ jid: OWNER, from: OWNER, text: '.token' });
  const tokenTxt = (tk1.respostas.join(' ').match(/sk_[0-9a-f]{48}/) || [])[0];
  const tfile = path.join(tmp, 'database', 'token.json');
  chk('.token (dono, privado) gera e guarda em database/token.json (permissões 600)', !!tokenTxt && (db.flush(), fs.existsSync(tfile)) && (fs.statSync(tfile).mode & 0o777) === 0o600, tk1.respostas.join('|').slice(0, 120));
  chk('.token repetido mostra o mesmo token', (await enviar({ jid: OWNER, from: OWNER, text: '.token' })).respostas.join(' ').includes(tokenTxt));
  const tk2 = await enviar({ jid: OWNER, from: OWNER, text: '.token novo' });
  chk('.token novo gera outro', !tk2.respostas.join(' ').includes(tokenTxt) && /sk_/.test(tk2.respostas.join(' ')));
  chk('.token nunca aparece em grupo nem para membros', (await enviar({ from: OWNER, text: '.token' })).final === '❌' && (await enviar({ jid: M3, from: M3, text: '.token' })).respostas.every((x) => !/sk_[0-9a-f]{20}/.test(x)));
  chk('.settoken valida o formato e .configurartoken é atalho', (await enviar({ jid: OWNER, from: OWNER, text: '.settoken curto' })).final === '❌' && (await enviar({ jid: OWNER, from: OWNER, text: '.configurartoken outrotoken1234567890' })).final !== '❌' && db.get('token').dados.token === 'outrotoken1234567890');
  await enviar({ jid: OWNER, from: OWNER, text: '.migrartoken' });
  chk('.migrartoken roda o token e o anterior vale mais 24 h', db.get('token').dados.anterior === 'outrotoken1234567890' && db.get('token').dados.anteriorAte > Date.now());
  const tokenOk = R('src/services/tokenStore');
  chk('token antigo ainda é aceite durante a migração e um falso não', tokenOk.verificar(db, 'outrotoken1234567890') && !tokenOk.verificar(db, 'tokenfalso1234567890'));
  // mídia
  const sn = await enviar({ from: M3, text: '.s' });
  chk('.s sem foto avisa "responde a uma foto"', sn.respostas.some((x) => /Responde a uma foto/i.test(x)));
  if (ff && TEM_FFMPEG) {
    const st = await enviar({ from: M3, content: { imageMessage: { caption: '.s' } } });
    const w = st.novos.find((x) => Buffer.isBuffer(x.content.sticker))?.content.sticker;
    chk('.s transforma a foto numa figurinha WebP', !!w && w.slice(0, 4).toString() === 'RIFF' && w.slice(8, 12).toString() === 'WEBP', `resp=${JSON.stringify(st.respostas)} final=${st.final}`);
    const mi = await enviar({ from: M3, content: { imageMessage: { caption: '.mirror' } } });
    const im = mi.novos.find((x) => Buffer.isBuffer(x.content.image))?.content.image;
    chk('.mirror devolve a imagem espelhada', !!im && im.length > 100 && !im.equals(JPG), `resp=${JSON.stringify(mi.respostas)} final=${mi.final}`);
  } else { chk('.s/.mirror (ffmpeg ausente neste computador: teste ignorado)', true); }
  chk('.upload (dono) guardou o ficheiro em assets/', fs.existsSync(path.join(tmp, 'assets', 'anime', 'teste.jpg')));
  const upm = await enviar({ from: M3, content: { imageMessage: { caption: '.upload anime/x' } } });
  chk('.upload só o dono', upm.final === '❌', `final=${upm.final} resp=${JSON.stringify(upm.respostas)}`);

  await cmd('anular');
  chk('anular desactiva o aluguer', !rental.isActive(G));

  // ---------- Relatório ----------
  const faltam = nomes.filter((n) => !resultados.has(n));
  let md = '# AUDITORIA — SASUKE V31.3 — SHADOW GOD\n\n';
  md += `Gerado em ${new Date().toISOString()} · Node ${process.version}\n\n`;
  md += '> Testes feitos com um **WhatsApp simulado** (sem rede e sem Baileys). Validam lógica, permissões, aluguer, persistência e respostas. **Não** substituem o teste com uma conta real: ligação, Pairing Code, envio real de fotos, APIs externas e a estabilidade da sessão só se confirmam no WhatsApp.\n\n';
  const cont = { OK: 0, PLACEHOLDER: 0, 'OK-EXTERNO': 0, 'OK-REGRA': 0, FALHA: 0 };
  for (const n of nomes) cont[resultados.get(n)?.estado || 'FALHA']++;
  md += `Nomes no menu: **${nomes.length}** · comandos distintos: **${registry.commands.list.length}** · nomes registados (com atalhos): **${registry.commands.map.size}**\n\n`;
  md += `**Resumo:** ✅ ${cont.OK} OK · 🟡 ${cont['OK-EXTERNO']} dependem de fonte externa/configuração · 🛡️ ${cont['OK-REGRA']} recusa por regra · ⬜ ${cont.PLACEHOLDER} placeholders · ❌ ${cont.FALHA} falhas\n\n`;
  md += '## Verificações\n\n| Verificação | Resultado |\n|---|---|\n';
  for (const c of checks) md += `| ${c.nome} | ${c.ok ? '✅' : '❌ ' + c.det} |\n`;
  md += '\n## Todos os nomes do menu\n\n| Nome | Comando | Resultado |\n|---|---|---|\n';
  const sim = { OK: '✅ OK', PLACEHOLDER: '⬜ placeholder', 'OK-EXTERNO': '🟡 externo/config', 'OK-REGRA': '🛡️ regra', FALHA: '❌' };
  for (const n of nomes) {
    const r = resultados.get(n) || { estado: 'FALHA', nota: 'não executado' };
    const c = registry.commands.map.get(n);
    md += `| .${n} | ${c ? (c.name === n ? 'principal' : '→ .' + c.name) : '—'} | ${sim[r.estado]}${r.estado === 'FALHA' ? ' ' + r.nota : ''} |\n`;
  }
  fs.writeFileSync(path.join(ROOT, 'AUDITORIA.md'), md);

  const falhas = cont.FALHA + faltam.length + checks.filter((c) => !c.ok).length + extras.filter((e) => e.estado === 'FALHA').length;
  console.log(`Nomes: ${nomes.length} · OK ${cont.OK} · externos ${cont['OK-EXTERNO']} · regra ${cont['OK-REGRA']} · placeholders ${cont.PLACEHOLDER} · falhas ${cont.FALHA}`);
  for (const c of checks) console.log(`${c.ok ? '✅' : '❌'} ${c.nome}${c.ok ? '' : ' — ' + c.det}`);
  for (const n of nomes) { const r = resultados.get(n); if (!r || r.estado === 'FALHA') console.log(`❌ .${n}: ${r ? r.nota : 'não executado'}`); }
  for (const e of extras) if (e.estado === 'FALHA') console.log(`❌ ${e.nome}: ${e.nota}`);
  db.close(); session.scheduler.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO NA AUDITORIA:', e); process.exit(2); });
