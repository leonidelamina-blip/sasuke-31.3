'use strict';
const log = require('./logger');

/**
 * Descarrega a imagem/vídeo da mensagem (ou da mensagem respondida).
 * Nunca lança erro: devolve { buf, tipo } ou null.
 */
async function baixar(ctx, tipos = ['imageMessage']) {
  try {
    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
    let alvo = null; let tipo = null;
    if (tipos.includes(ctx.type)) { alvo = ctx.msg; tipo = ctx.type; } else {
      const q = ctx.quotedMessage;
      const t = q && tipos.find((x) => q[x]);
      if (t) { alvo = { key: { remoteJid: ctx.jid, id: ctx.quotedId, participant: ctx.quotedSender }, message: { [t]: q[t] } }; tipo = t; }
    }
    if (!alvo) return null;
    const buf = await downloadMediaMessage(alvo, 'buffer', {}, { reuploadRequest: ctx.sock.updateMediaMessage });
    return Buffer.isBuffer(buf) && buf.length ? { buf, tipo } : null;
  } catch (e) {
    log.warn('Média não descarregada: ' + e.message);
    return null;
  }
}

module.exports = { baixar };
