'use strict';

const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;

/** Só 1 emoji (um único "carácter" visível). Nunca texto longo, nem emoji duplo. */
function emojiValido(e) {
  const s = String(e).trim();
  if (!s || s.length > 16) return false;
  const n = seg ? [...seg.segment(s)].length : [...s].length;
  return n === 1 && /\p{Extended_Pictographic}/u.test(s);
}

/**
 * Reage a uma mensagem. A reacção é OPCIONAL e NUNCA pode quebrar um comando nem o bot:
 * qualquer erro é ignorado. Só é chamada DEPOIS de o comando correr.
 * `scheduler` é opcional: se existir, a reacção passa pela fila de envio.
 */
async function safeReact(sock, m, emoji, scheduler) {
  try {
    if (!emoji) return;
    if (typeof emoji !== 'string') return;
    if (emoji.trim() === '') return;
    if (!emojiValido(emoji)) return;
    const jid = m.key.remoteJid;
    const enviar = (s) => (s || sock).sendMessage(jid, { react: { text: emoji, key: m.key } });
    if (scheduler) await scheduler.enqueue(jid, 'react', enviar, { typing: false, dedupeKey: `R:${m.key.id}:${emoji}` });
    else await sock.sendMessage(jid, { react: { text: emoji, key: m.key } });
  } catch (e) {
    // ignora erro de reacção: não faz nada, não dá crash
  }
}

module.exports = { safeReact, emojiValido };
