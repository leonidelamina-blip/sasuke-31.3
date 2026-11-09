'use strict';
const { jidToNumber } = require('../utils/helpers');
const { formatDate } = require('../utils/helpers');
const { fetchBuffer } = require('../utils/http');
const anime = require('./anime');
const log = require('../utils/logger');

const BOAS_VINDAS = [
  '╔═══ 🩸 𝑺𝑯𝑨𝑫𝑶𝑾 𝑮𝑶𝑫 🩸 ═══╗', '👁️ 𝑵𝑶𝑽𝑶 𝑴𝑬𝑴𝑩𝑹𝑶', '╚════════════════════════╝', '',
  '⚫ Bem-vindo(a), @{numero}!', '', '🩸 Um novo membro entrou no território Uchiha.', '',
  '👑 Grupo: {grupo}', '', '👥 Membro: {nome}', '', '⚡ Respeita as regras e aproveita a comunidade.', '', '👁️ 𝑺𝑨𝑺𝑼𝑲𝑬 𝑽31.1',
].join('\n');

const DESPEDIDA = [
  '╔═══ 🩸 𝑺𝑯𝑨𝑫𝑶𝑾 𝑮𝑶𝑫 🩸 ═══╗', '👁️ 𝑴𝑬𝑴𝑩𝑹𝑶 𝑺𝑨𝑰𝑼', '╚════════════════════════╝', '',
  '⚫ @{numero} deixou o território Uchiha.', '', '🥀 A sua jornada neste grupo chegou ao fim.', '',
  '👑 Grupo: {grupo}', '', '👁️ 𝑺𝑨𝑺𝑼𝑲𝑬 𝑽31.1',
].join('\n');

function render(tpl, v) {
  return String(tpl)
    .replace(/\{(nome|numero|grupo|membros|data|hora|foto)\}/g, (_, k) => (k === 'foto' ? '' : String(v[k] ?? '')))
    .replace(/\n{3,}/g, '\n\n').trim();
}

function partJid(p) { return typeof p === 'string' ? p : (p.phoneNumber || p.id); }

function variaveis(env, gid, jid, meta, config) {
  const num = jidToNumber(jid);
  const u = env.db.get('usuarios').usuarios[num];
  const now = Date.now();
  const [data, hora] = formatDate(now, config.fusoHorario).split(/,?\s+/);
  return { nome: u?.nome || num, numero: num, grupo: meta?.subject || '', membros: meta?.participants?.length ?? '', data, hora };
}

/** Fotografia real do participante; se não existir, imagem padrão; se nem essa existir, null (só texto). */
async function fotoDe(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, 'image');
    if (url) return await fetchBuffer(url, { timeout: 12000 });
  } catch { /* sem foto pública */ }
  return anime.imagemPadrao();
}

async function enviar(env, gid, jid, texto) {
  const foto = await fotoDe(env.sock, jid);
  const content = foto ? { image: foto, caption: texto, mentions: [jid] } : { text: texto, mentions: [jid] };
  await env.scheduler.send(gid, content, { dedupeKey: `ev:${gid}:${jid}:${texto.length}` });
}

async function boasVindas(env, gid, jid, meta) {
  const cfg = env.db.groupConfig(gid);
  const rec = env.db.groupRecord(gid);
  if (meta?.participants) { rec.membros = meta.participants.length; env.db.save('grupos'); } // contagem actualizada
  if (!cfg.boasvindas) return;
  await enviar(env, gid, jid, render(cfg.boasvindasTexto || BOAS_VINDAS, variaveis(env, gid, jid, meta, env.config)));
}

async function despedida(env, gid, jid, meta, removido) {
  const cfg = env.db.groupConfig(gid);
  const rec = env.db.groupRecord(gid);
  if (meta?.participants) { rec.membros = meta.participants.length; env.db.save('grupos'); }
  if (!cfg.saidas) return;
  let t = render(cfg.saidaTexto || DESPEDIDA, variaveis(env, gid, jid, meta, env.config));
  if (!cfg.saidaTexto) t = t.replace('🥀 A sua jornada neste grupo chegou ao fim.', removido ? '🥀 Foi removido do grupo.' : '🥀 Saiu por vontade própria. A sua jornada chegou ao fim.');
  await enviar(env, gid, jid, t);
}

module.exports = { BOAS_VINDAS, DESPEDIDA, render, partJid, boasVindas, despedida, fotoDe, log };
