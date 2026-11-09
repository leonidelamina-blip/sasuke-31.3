'use strict';
const { ativo, isento, punir } = require('../services/protecao');

const INVITE = /chat\.whatsapp\.com\/[A-Za-z0-9]{8,}/i;
const CANAL = /whatsapp\.com\/channel\/[A-Za-z0-9]+/i;
const QUALQUER = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|me|co|mz|br|pt|app|xyz|site|link|ly|gg|tv|info|shop|store)\b(\/\S*)?/i;

const hook = (name, motivo, teste) => ({
  name,
  async onMessage(ctx) {
    if (!ctx.isGroup || isento(ctx) || !ativo(ctx.db, ctx.jid, name)) return false;
    if (!teste(ctx)) return false;
    await punir(ctx, motivo);
    return true;
  },
});

module.exports = [
  hook('antilink', 'enviou um link de grupo. Não é permitido.', (c) => INVITE.test(c.text)),
  hook('antilinkhard', 'enviou um link. Links não são permitidos neste grupo.', (c) => QUALQUER.test(c.text)),
  hook('anticanal', 'partilhou um canal. Não é permitido.', (c) => CANAL.test(c.text)
    || !!c.content[c.type]?.contextInfo?.forwardedNewsletterMessageInfo),
];
