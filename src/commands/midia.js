'use strict';
const fs = require('fs');
const path = require('path');
const { baixar } = require('../utils/media');
const { paraFigurinha, espelhar } = require('../services/sticker');
const { userError } = require('../utils/format');

const CAT = 'MÍDIA';
const ASSETS = () => path.join(process.cwd(), 'assets');
const NOME_OK = /^((anime\/(wallpapers\/)?|amv\/)?[\w-]{1,40})$/;
const MAX_UP = 15 * 1024 * 1024;

module.exports = [
  {
    name: 'sticker', category: CAT, desc: 'Transforma uma foto/vídeo curto em figurinha (atalho: .s)', reaction: '🖼️',
    async run(ctx) {
      const r = await baixar(ctx, ['imageMessage', 'videoMessage']);
      if (!r) throw userError('Responde a uma foto (ou vídeo curto) com .s, ou envia a foto com a legenda .s');
      const seg = ctx.content.videoMessage?.seconds ?? ctx.quotedMessage?.videoMessage?.seconds ?? 0;
      if (r.tipo === 'videoMessage' && Number(seg) > 10) throw userError('Vídeo demasiado longo para figurinha (máximo 10 segundos).');
      const webp = await paraFigurinha(r.buf, { video: r.tipo === 'videoMessage' });
      await ctx.send({ sticker: webp });
    },
  },
  {
    name: 'mirror', category: CAT, desc: 'Espelha a foto (horizontalmente)', reaction: '🪞',
    async run(ctx) {
      const r = await baixar(ctx, ['imageMessage']);
      if (!r) throw userError('Responde a uma foto com .mirror, ou envia a foto com a legenda .mirror');
      await ctx.send({ image: await espelhar(r.buf), caption: '🪞 Espelhado' });
    },
  },
  {
    name: 'upload', category: CAT, desc: 'Dono: guarda a foto/vídeo enviado em assets/', reaction: '📥', level: 'dono', nuncaLiberar: true, free: true,
    async run(ctx) {
      const nome = (ctx.args[0] || '').toLowerCase();
      if (!nome || !NOME_OK.test(nome)) {
        throw userError('Uso: envia a foto (ou responde a ela) com .upload <nome>\nExemplos: .upload sasuke · .upload dono · .upload padrao · .upload anime/itachi · .upload anime/wallpapers/w1 · .upload amv/video1 (vídeo)');
      }
      const video = nome.startsWith('amv/');
      const r = await baixar(ctx, video ? ['videoMessage'] : ['imageMessage']);
      if (!r) throw userError(`Envia ${video ? 'o vídeo' : 'a foto'} com a legenda .upload ${nome} (ou responde a ela).`);
      if (r.buf.length > MAX_UP) throw userError('Ficheiro demasiado grande (máximo 15 MB).');
      const destino = path.join(ASSETS(), nome + (video ? '.mp4' : '.jpg'));
      const existia = fs.existsSync(destino);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, r.buf);
      await ctx.reply(`📥 ${existia ? 'Substituído' : 'Guardado'}: assets/${nome}${video ? '.mp4' : '.jpg'} (${Math.round(r.buf.length / 1024)} KB)`);
    },
  },
];
