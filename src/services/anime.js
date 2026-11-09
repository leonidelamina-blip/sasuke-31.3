'use strict';
const fs = require('fs');
const path = require('path');
const { sleep } = require('../utils/helpers');
const { fetchJson, fetchBuffer, indisponivel } = require('../utils/http');
const { userError, pick } = require('../utils/format');
const log = require('../utils/logger');

const ASSETS = path.join(process.cwd(), 'assets');
const ANIME_DIR = path.join(ASSETS, 'anime');
const EXT = ['.jpg', '.jpeg', '.png', '.webp'];

let lastCall = 0;
async function jikan(p) {
  const wait = lastCall + 450 - Date.now(); // a Jikan limita ~3 pedidos/seg
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  try { return await fetchJson('https://api.jikan.moe/v4' + p, { timeout: 15000 }); } catch (e) {
    log.warn('Jikan falhou: ' + e.message);
    throw indisponivel('Jikan');
  }
}

function localImage(dir, key) {
  for (const e of EXT) {
    const f = path.join(dir, key + e);
    if (fs.existsSync(f)) return fs.readFileSync(f);
  }
  return null;
}

async function procurar(q) {
  const j = await jikan(`/characters?q=${encodeURIComponent(q)}&limit=1&order_by=favorites&sort=desc`);
  return j?.data?.[0] || null;
}

async function completo(id) {
  const j = await jikan(`/characters/${id}/full`);
  return j?.data || null;
}

/** Imagem do personagem: ficheiro local (assets/anime/<key>.jpg) → Jikan (guarda em cache no disco). */
async function imagemPersonagem(key, busca) {
  const local = localImage(ANIME_DIR, key);
  if (local) return local;
  const c = await procurar(busca);
  const url = c?.images?.jpg?.image_url;
  if (!url) throw userError('Não encontrei fotografia para este personagem.');
  let buf;
  try { buf = await fetchBuffer(url); } catch { throw indisponivel('imagens'); }
  try { fs.mkdirSync(ANIME_DIR, { recursive: true }); fs.writeFileSync(path.join(ANIME_DIR, key + '.jpg'), buf); } catch { /* sem cache */ }
  return buf;
}

/** Fotografia oficial do Sasuke: assets/sasuke.jpg; se faltar tenta obter e guardar. Lança erro explícito se impossível. */
async function fotoSasuke() {
  const f = path.join(ASSETS, 'sasuke.jpg');
  if (fs.existsSync(f)) return fs.readFileSync(f);
  try {
    const buf = await imagemPersonagem('sasuke', 'Sasuke Uchiha');
    try { fs.mkdirSync(ASSETS, { recursive: true }); fs.writeFileSync(f, buf); } catch { /* ignora */ }
    return buf;
  } catch {
    throw userError('Fotografia oficial do Sasuke não encontrada (assets/sasuke.jpg) e não foi possível obtê-la online.');
  }
}

/** Imagem padrão para boas-vindas/despedidas: assets/padrao.jpg → assets/sasuke.jpg → null. */
function imagemPadrao() {
  for (const n of ['padrao.jpg', 'sasuke.jpg']) {
    const f = path.join(ASSETS, n);
    if (fs.existsSync(f)) return fs.readFileSync(f);
  }
  return null;
}

/** Fotografia do proprietário (assets/dono.jpg) ou null. */
function fotoDono() {
  const f = path.join(ASSETS, 'dono.jpg');
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}

async function personagemInfo(nome) {
  const c = await procurar(nome);
  if (!c) return null;
  const full = await completo(c.mal_id);
  const buf = c.images?.jpg?.image_url ? await fetchBuffer(c.images.jpg.image_url).catch(() => null) : null;
  return { c, full, buf };
}

async function waifuAleatoria(lista) {
  const nome = pick(lista);
  const c = await procurar(nome);
  if (!c) throw userError('Não encontrei essa personagem na fonte externa.');
  const full = await completo(c.mal_id);
  const url = c.images?.jpg?.image_url;
  let buf = null;
  try { buf = url ? await fetchBuffer(url) : null; } catch { /* trata abaixo */ }
  if (!buf) throw indisponivel('imagens');
  const anime = full?.anime?.[0]?.anime?.title || 'Desconhecido';
  return { nome: c.name, anime, buf };
}

function wallpaperLocal() {
  const dir = path.join(ANIME_DIR, 'wallpapers');
  try {
    const fs2 = fs.readdirSync(dir).filter((f) => EXT.includes(path.extname(f).toLowerCase()));
    if (fs2.length) return fs.readFileSync(path.join(dir, pick(fs2)));
  } catch { /* sem pasta */ }
  return null;
}

async function wallpaper() {
  const local = wallpaperLocal();
  if (local) return local;
  const fontes = [
    async () => { const j = await fetchJson('https://api.waifu.im/search?is_nsfw=false&orientation=LANDSCAPE'); return j?.images?.[0]?.url; },
    async () => { const j = await fetchJson('https://nekos.best/api/v2/waifu'); return j?.results?.[0]?.url; },
    async () => { const j = await fetchJson('https://api.waifu.pics/sfw/waifu'); return j?.url; },
  ];
  for (const f of fontes) {
    try {
      const url = await f();
      if (url) return await fetchBuffer(url);
    } catch { /* tenta a seguinte */ }
  }
  throw indisponivel('wallpapers');
}

async function citacao() {
  let q = null;
  try {
    const j = await fetchJson('https://api.animechan.io/v1/quotes/random');
    if (j?.data?.content) q = { frase: j.data.content, personagem: j.data.character?.name, anime: j.data.anime?.name };
  } catch { /* tenta a seguinte */ }
  if (!q) {
    try {
      const j = await fetchJson('https://animechan.vercel.app/api/random');
      if (j?.quote) q = { frase: j.quote, personagem: j.character, anime: j.anime };
    } catch { /* falhou */ }
  }
  if (!q) throw indisponivel('citações');
  let buf = null;
  try {
    if (q.personagem) {
      const c = await procurar(q.personagem);
      if (c?.images?.jpg?.image_url) buf = await fetchBuffer(c.images.jpg.image_url);
    }
  } catch { /* sem foto */ }
  if (!buf) {
    try { const j = await fetchJson('https://api.waifu.pics/sfw/waifu'); buf = await fetchBuffer(j.url); } catch { /* sem foto */ }
  }
  if (!buf) throw indisponivel('imagens');
  return { ...q, buf };
}

function amvLocal(config) {
  const dir = path.join(ASSETS, 'amv');
  const files = [];
  try { for (const f of fs.readdirSync(dir)) if (/\.(mp4|mkv|webm)$/i.test(f)) files.push(path.join(dir, f)); } catch { /* sem pasta */ }
  const urls = (config.amv?.urls || []).filter((u) => /^https?:\/\//.test(u));
  return { files, urls };
}

module.exports = { jikan, procurar, completo, imagemPersonagem, fotoSasuke, imagemPadrao, fotoDono, personagemInfo, waifuAleatoria, wallpaper, citacao, amvLocal, ASSETS };
