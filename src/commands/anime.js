'use strict';
const anime = require('../services/anime');
const { PERSONAGENS, legenda, WAIFUS } = require('../services/animeData');
const { fonte1, userError, pick, tag } = require('../utils/format');
const { jidToNumber } = require('../utils/helpers');
const { fetchBuffer } = require('../utils/http');
const fs = require('fs');

const C = 'Anime';
const base = { categoria: C };

const personagem = (key) => ({
  ...base, name: key, reaction: PERSONAGENS[key].reaction, descricao: `Fotografia e ficha de ${PERSONAGENS[key].busca}`,
  async run(ctx) {
    const p = PERSONAGENS[key];
    const img = await anime.imagemPersonagem(key, p.busca);
    await ctx.send({ image: img, caption: legenda(key) });
  },
});

const corta = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

module.exports = [
  ...['sasuke', 'naruto', 'itachi', 'madara', 'kakashi', 'sakura', 'hinata', 'obito'].map(personagem),
  {
    ...base, name: 'waifu', reaction: '💖', descricao: 'Waifu aleatória com fotografia, nome e anime',
    async run(ctx) {
      const w = await anime.waifuAleatoria(WAIFUS);
      await ctx.send({ image: w.buf, caption: `💖 ${fonte1(w.nome.toUpperCase())}\n🎌 Anime: ${w.anime}` });
    },
  },
  {
    ...base, name: 'anime', reaction: '🎌', descricao: 'Pesquisa um personagem de anime',
    async run(ctx) {
      if (!ctx.argText) throw userError('Uso: .anime <nome do personagem>');
      const r = await anime.personagemInfo(ctx.argText.slice(0, 60));
      if (!r) throw userError('Não encontrei esse personagem.');
      const c = r.c; const animes = (r.full?.anime || []).slice(0, 3).map((a) => a.anime?.title).filter(Boolean);
      const cap = [
        `🎌 ${fonte1(String(c.name).toUpperCase())}${c.name_kanji ? ' · ' + c.name_kanji : ''}`,
        c.nicknames?.length ? `🏷️ Alcunhas: ${c.nicknames.slice(0, 3).join(', ')}` : null,
        animes.length ? `📺 Anime: ${animes.join(' · ')}` : null,
        `❤️ Favoritos: ${c.favorites ?? 0}`,
        c.about ? `\n${corta(c.about.replace(/\n+/g, ' '), 350)}` : null,
      ].filter(Boolean).join('\n');
      await ctx.send(r.buf ? { image: r.buf, caption: cap } : { text: cap });
    },
  },
  {
    ...base, name: 'wallpaper', reaction: '🖼️', descricao: 'Wallpaper de anime',
    async run(ctx) { await ctx.send({ image: await anime.wallpaper(), caption: '🖼️ Wallpaper' }); },
  },
  {
    ...base, name: 'quote', reaction: '💬', descricao: 'Frase de anime com fotografia',
    async run(ctx) {
      const q = await anime.citacao();
      await ctx.send({ image: q.buf, caption: `💬 “${q.frase}”\n\n— ${q.personagem || 'Desconhecido'}${q.anime ? ' · ' + q.anime : ''}` });
    },
  },
  {
    ...base, name: 'amv', reaction: '🎞️', descricao: 'Envia um AMV da biblioteca local ou de fontes configuradas',
    async run(ctx) {
      const { files, urls } = anime.amvLocal(ctx.config);
      const opcoes = [...files, ...urls];
      if (!opcoes.length) throw userError('Nenhuma fonte de AMV configurada. O proprietário deve colocar vídeos em assets/amv/ ou URLs directos em config.json (amv.urls).');
      const o = pick(opcoes);
      let buf;
      try { buf = o.startsWith('http') ? await fetchBuffer(o, { timeout: 40000 }) : fs.readFileSync(o); } catch { throw userError('Fonte de AMV indisponível de momento. Tenta mais tarde.'); }
      await ctx.send({ video: buf, caption: '🎞️ AMV', mimetype: 'video/mp4' }, { kind: 'video' });
    },
  },
  {
    ...base, name: 'otaku', reaction: '🏆', descricao: 'Ranking de pontos dos utilizadores',
    async run(ctx) {
      const top = Object.entries(ctx.db.get('ranking').global).filter(([, v]) => v.pontos > 0).sort((a, b) => b[1].pontos - a[1].pontos).slice(0, 10);
      if (!top.length) return ctx.reply('🏆 Ainda não há pontuações registadas.');
      const m = ['🥇', '🥈', '🥉'];
      await ctx.send({
        text: '🏆 RANKING OTAKU\n\n' + top.map(([n, v], i) => `${m[i] || `${i + 1}.`} @${n} — ${v.pontos} pts${v.streak > 1 ? ` · 🔥${v.streak}` : ''}`).join('\n'),
        mentions: top.map(([n]) => n + '@s.whatsapp.net'),
      });
    },
  },
];
