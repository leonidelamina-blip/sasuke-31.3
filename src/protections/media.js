'use strict';
const { ativo, isento, punir } = require('../services/protecao');

const mk = (name, tipos, motivo) => ({
  name,
  async onMessage(ctx) {
    if (!ctx.isGroup || isento(ctx) || !tipos.includes(ctx.type) || !ativo(ctx.db, ctx.jid, name)) return false;
    await punir(ctx, motivo);
    return true;
  },
});

const viewOnce = (ctx) => {
  const raw = ctx.msg.message || {};
  return !!(raw.viewOnceMessage || raw.viewOnceMessageV2 || raw.viewOnceMessageV2Extension || ctx.content[ctx.type]?.viewOnce === true);
};

module.exports = [
  mk('antifoto', ['imageMessage'], 'enviou uma foto. Fotos não são permitidas.'),
  mk('antivideo', ['videoMessage'], 'enviou um vídeo. Vídeos não são permitidos.'),
  mk('antiaudio', ['audioMessage'], 'enviou um áudio. Áudios não são permitidos.'),
  mk('antisticker', ['stickerMessage'], 'enviou um sticker. Stickers não são permitidos.'),
  mk('antidoc', ['documentMessage'], 'enviou um documento. Documentos não são permitidos.'),
  {
    name: 'antiviewonce',
    async onMessage(ctx) {
      if (!ctx.isGroup || isento(ctx) || !ativo(ctx.db, ctx.jid, 'antiviewonce') || !viewOnce(ctx)) return false;
      await punir(ctx, 'enviou conteúdo de visualização única. Não é permitido.');
      return true;
    },
  },
];
