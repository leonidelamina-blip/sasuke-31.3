'use strict';
// Guarda em memória as últimas mensagens recebidas (para .antidelete, .limpar, .revelar).
const PER_CHAT = 200;
const MAX_CHATS = 300;
const chats = new Map();

function add(jid, msg) {
  if (!msg?.key?.id) return;
  let arr = chats.get(jid);
  if (!arr) {
    if (chats.size >= MAX_CHATS) chats.delete(chats.keys().next().value);
    arr = []; chats.set(jid, arr);
  }
  arr.push(msg);
  if (arr.length > PER_CHAT) arr.shift();
}
const find = (jid, id) => (chats.get(jid) || []).find((m) => m.key.id === id) || null;
const last = (jid, n) => (chats.get(jid) || []).slice(-n);
function remove(jid, ids) {
  const arr = chats.get(jid);
  if (!arr) return;
  const s = new Set(ids);
  chats.set(jid, arr.filter((m) => !s.has(m.key.id)));
}
const clear = () => chats.clear();

module.exports = { add, find, last, remove, clear };
