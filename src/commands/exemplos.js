'use strict';
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const { fetchBuffer } = require('../utils/http');
const { userError } = require('../utils/format');
const { safeReact } = require('../utils/safeReact');

const CAT = 'ENVIO & EXEMPLOS';
const ASSETS = path.join(process.cwd(), 'assets');

function ipPrivado(ip) {
  if (/^::ffff:/i.test(ip)) ip = ip.slice(7);
  if (ip.includes(':')) return /^(::1?$|f[cd]|fe80)/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
}

/** Só http(s) público: bloqueia localhost e redes privadas. */
async function urlSegura(raw) {
  let u;
  try { u = new URL(raw); } catch { throw userError('URL inválido.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw userError('Só são aceites URLs http ou https.');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) throw userError('Endereço não permitido.');
  let addrs;
  try { addrs = await dns.lookup(u.hostname, { all: true }); } catch { throw userError('Não consegui resolver o endereço desse URL.'); }
  if (addrs.some((a) => ipPrivado(a.address))) throw userError('Endereço não permitido.');
  return u.href;
}

async function buffer(ctx) {
  const url = await urlSegura(ctx.args[0] || '');
  try { return await fetchBuffer(url, { timeout: 30000 }); } catch { throw userError('Não consegui descarregar esse ficheiro (indisponível ou demasiado grande).'); }
}

function ficheiro(dir, nome, exts) {
  const d = path.join(ASSETS, dir);
  let lista = [];
  try { lista = fs.readdirSync(d).filter((f) => exts.includes(path.extname(f).toLowerCase())); } catch { /* sem pasta */ }
  if (!lista.length) throw userError(`Não há ficheiros em assets/${dir}/.`);
  if (!nome) throw userError(`Escolhe um ficheiro: ${lista.slice(0, 20).map((f) => path.parse(f).name).join(', ')}`);
  if (!/^[\w-]{1,40}$/.test(nome)) throw userError('Nome de ficheiro inválido.');
  const f = lista.find((x) => path.parse(x).name === nome);
  if (!f) throw userError(`Ficheiro não encontrado. Opções: ${lista.slice(0, 20).map((x) => path.parse(x).name).join(', ')}`);
  return fs.readFileSync(path.join(d, f));
}

const mk = (name, desc, run) => ({ name, desc, category: CAT, reaction: '📤', run });
const IMG = ['.jpg', '.jpeg', '.png', '.webp'];
const VID = ['.mp4', '.mkv', '.webm'];
const U = 'Uso: .{n} <URL público>';

module.exports = [
  mk('enviar-texto', 'Exemplo: envia uma mensagem de texto', (ctx) => ctx.send({ text: ctx.argText || '📤 Exemplo de mensagem de texto.' }, { quoted: null })),
  mk('enviar-resposta', 'Exemplo: responde (reply) à tua mensagem', (ctx) => ctx.reply(ctx.argText || '📤 Esta é uma resposta (reply) à tua mensagem.')),
  mk('enviar-reacoes', 'Exemplo: reage à tua mensagem', async (ctx) => {
    await safeReact(ctx.sock, ctx.msg, ctx.args[0] || '👍', ctx.scheduler);
    await ctx.reply('📤 Reacção enviada (se o emoji for válido).');
  }),
  mk('enviar-lista', 'Exemplo: lista de opções', (ctx) => ctx.reply('📤 Lista de exemplo:\n1️⃣ Opção A\n2️⃣ Opção B\n3️⃣ Opção C\n\nResponde com o número.')),
  mk('enviar-imagem-de-url', 'Exemplo: imagem a partir de um URL', async (ctx) => {
    if (!ctx.args[0]) throw userError(U.replace('{n}', 'enviar-imagem-de-url'));
    await ctx.send({ image: { url: await urlSegura(ctx.args[0]) }, caption: '📤 Imagem de URL' });
  }),
  mk('enviar-imagem-de-buffer', 'Exemplo: imagem descarregada para memória (buffer)', async (ctx) => {
    if (!ctx.args[0]) throw userError(U.replace('{n}', 'enviar-imagem-de-buffer'));
    await ctx.send({ image: await buffer(ctx), caption: '📤 Imagem de buffer' });
  }),
  mk('enviar-imagem-de-arquivo', 'Exemplo: imagem de assets/anime/', async (ctx) => {
    await ctx.send({ image: ficheiro('anime', ctx.args[0], IMG), caption: '📤 Imagem de arquivo' });
  }),
  mk('enviar-video-de-url', 'Exemplo: vídeo a partir de um URL', async (ctx) => {
    if (!ctx.args[0]) throw userError(U.replace('{n}', 'enviar-video-de-url'));
    await ctx.send({ video: { url: await urlSegura(ctx.args[0]) }, caption: '📤 Vídeo de URL' }, { kind: 'video' });
  }),
  mk('enviar-video-de-buffer', 'Exemplo: vídeo descarregado para memória (buffer)', async (ctx) => {
    if (!ctx.args[0]) throw userError(U.replace('{n}', 'enviar-video-de-buffer'));
    await ctx.send({ video: await buffer(ctx), caption: '📤 Vídeo de buffer' }, { kind: 'video' });
  }),
  mk('enviar-video-de-arquivo', 'Exemplo: vídeo de assets/amv/', async (ctx) => {
    await ctx.send({ video: ficheiro('amv', ctx.args[0], VID), caption: '📤 Vídeo de arquivo' }, { kind: 'video' });
  }),
  mk('enviar-gif-de-url', 'Exemplo: GIF (vídeo mp4 em loop) a partir de um URL', async (ctx) => {
    if (!ctx.args[0]) throw userError(U.replace('{n}', 'enviar-gif-de-url') + ' (ficheiro mp4)');
    await ctx.send({ video: { url: await urlSegura(ctx.args[0]) }, gifPlayback: true, caption: '📤 GIF de URL' }, { kind: 'video' });
  }),
  mk('enviar-gif-de-buffer', 'Exemplo: GIF (mp4 em loop) descarregado para memória', async (ctx) => {
    if (!ctx.args[0]) throw userError(U.replace('{n}', 'enviar-gif-de-buffer') + ' (ficheiro mp4)');
    await ctx.send({ video: await buffer(ctx), gifPlayback: true, caption: '📤 GIF de buffer' }, { kind: 'video' });
  }),
  mk('exemplo-poll', 'Exemplo: enquete (poll)', async (ctx) => {
    const nome = ctx.argText || 'Qual é o teu personagem favorito?';
    await ctx.scheduler.enqueue(ctx.jid, 'text', (s) => s.sendMessage(ctx.jid, { poll: { name: nome.slice(0, 100), values: ['Sasuke', 'Itachi', 'Naruto', 'Madara'], selectableCount: 1 } }), { typing: false });
  }),
  mk('exemplos', 'Lista os exemplos de envio disponíveis', (ctx) => {
    const l = ctx.registry.commands.list.filter((c) => c.category === CAT).map((c) => ctx.config.prefixo + c.name);
    return ctx.reply('📤 Exemplos de envio:\n' + l.join('\n'));
  }),
  mk('funcoes-grupo', 'Lista as funções de gestão de grupo', (ctx) => {
    const cats = ['Membros', 'Administração', 'Mensagens', 'Protecções'];
    const l = ctx.registry.commands.list.filter((c) => cats.includes(c.category)).map((c) => ctx.config.prefixo + c.name);
    return ctx.reply('👥 Funções de grupo:\n' + l.join('  '));
  }),
  {
    ...mk('obter-dados-grupo', 'Dados do grupo (nome, membros, admins, definições)', async (ctx) => {
      const m = await ctx.refreshMeta();
      await ctx.reply(['👥 Dados do grupo', `📛 Nome: ${m.subject}`, `🆔 ID: ${m.id}`, `👤 Membros: ${m.participants.length}`, `👑 Admins: ${m.participants.filter((p) => p.admin).length}`, `💬 Mensagens: ${m.announce ? 'só admins' : 'todos'}`, `⚙️ Editar info: ${m.restrict ? 'só admins' : 'todos'}`].join('\n'));
    }),
    groupOnly: true,
  },
];
