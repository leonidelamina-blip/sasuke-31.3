'use strict';
const { normalizeMessageContent, getContentType } = require('@whiskeysockets/baileys');
const log = require('../utils/logger');
const textos = require('../utils/textos');
const { safeReact } = require('../utils/safeReact');
const { jidToNumber, isGroupJid } = require('../utils/helpers');

function extractText(c) {
  if (!c) return '';
  return c.conversation
    || c.extendedTextMessage?.text
    || c.imageMessage?.caption
    || c.videoMessage?.caption
    || c.documentMessage?.caption
    || '';
}

/** JIDs possíveis do remetente (pode vir como número ou como LID). */
function senderCandidates(msg, isGroup) {
  const k = msg.key;
  const c = isGroup
    ? [k.participant, k.participantPn, k.participantAlt]
    : [k.remoteJid, k.remoteJidAlt, k.senderPn];
  return c.filter(Boolean);
}

function findParticipant(meta, numbers) {
  if (!meta?.participants) return null;
  return meta.participants.find((p) =>
    [p.id, p.lid, p.phoneNumber].filter(Boolean).some((x) => numbers.includes(jidToNumber(x)))) || null;
}
const isAdminP = (p) => !!p && (p.admin === 'admin' || p.admin === 'superadmin');

function createHandler(env) {
  const { config, db, perms, rental, registry, session } = env;
  const prefix = config.prefixo;
  const seen = new Map();
  const rate = new Map();
  const warnedGroups = new Map();

  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [k, t] of seen) if (now - t > 120000) seen.delete(k);
    for (const [k, t] of warnedGroups) if (now - t > 3600000) warnedGroups.delete(k);
    for (const [k, arr] of rate) if (!arr.length || now - arr[arr.length - 1] > config.limites.janelaMs) rate.delete(k);
  }, 60000);
  cleaner.unref?.();

  function rateOk(number) {
    const now = Date.now();
    const arr = (rate.get(number) || []).filter((t) => now - t < config.limites.janelaMs);
    if (arr.length >= config.limites.comandosPorJanela) { rate.set(number, arr); return false; }
    arr.push(now); rate.set(number, arr);
    return true;
  }

  async function buildContext(msg, content, jid, isGroup) {
    const sock = session.sock;
    const candidates = senderCandidates(msg, isGroup);
    const numbers = candidates.map(jidToNumber);
    const sender = candidates.find((c) => c.endsWith('@s.whatsapp.net')) || candidates[0] || jid;
    const number = jidToNumber(sender);
    const type = getContentType(content);
    const ci = content[type]?.contextInfo;

    let meta = null;
    if (isGroup) {
      try { meta = await session.groups.get(sock, jid); } catch (e) { log.debug('groupMetadata falhou:', e.message); }
    }
    const isOwner = perms.isOwner(numbers);
    const isAdmin = isAdminP(findParticipant(meta, numbers));
    const botNums = [sock?.user?.id, sock?.user?.lid].filter(Boolean).map(jidToNumber);
    const botIsAdmin = isAdminP(findParticipant(meta, botNums));
    const level = perms.level({ isOwner, isAdmin, gid: isGroup ? jid : null, number });
    const text = extractText(content);

    const ctx = {
      session, sock, msg, m: msg, content, type, jid, isGroup, sender, number, numbers,
      pushName: msg.pushName || '', text, meta, isOwner, isAdmin, botIsAdmin, level,
      mentioned: ci?.mentionedJid || [],
      quotedSender: ci?.participant || null,
      quotedMessage: ci?.quotedMessage || null,
      quotedId: ci?.stanzaId || null,
      config, db, perms, rental, registry, scheduler: session.scheduler,
      sessions: session.services.sessions,
      admin: (fn, o = {}) => session.scheduler.run(jid, fn, o),
      command: null, invoked: null, args: [], argText: '',
      send: (c, o = {}) => session.scheduler.send(jid, c, { quoted: msg, ...o }),
      reply: (t, o = {}) => ctx.send({ text: t }, o),
      react: (e) => safeReact(session.sock, msg, e, session.scheduler),
      groupConfig: () => (isGroup ? db.groupConfig(jid) : null),
      refreshMeta: async () => {
        if (!isGroup) return null;
        ctx.meta = await session.groups.get(session.sock, jid, true);
        return ctx.meta;
      },
    };
    return ctx;
  }

  async function runHooks(ctx) {
    for (const hook of registry.hooks) {
      if (ctx.isGroup && !ctx.isOwner && hook.reservado !== false && !rental.isActive(ctx.jid)) continue;
      try {
        if (await hook.onMessage(ctx)) return true; // true = mensagem consumida
      } catch (e) {
        log.error(`Automatismo "${hook.name}" falhou:`, e);
      }
    }
    return false;
  }

  async function processMessage(msg) {
    const jid = msg.key?.remoteJid;
    if (!jid || !msg.message || msg.key.fromMe) return;
    if (jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return;

    const id = msg.key.id;
    if (id) {
      const k = `${jid}|${id}`;
      if (seen.has(k)) return;
      seen.set(k, Date.now());
    }

    const content = normalizeMessageContent(msg.message);
    if (!content) return;
    const isGroup = isGroupJid(jid);
    const ctx = await buildContext(msg, content, jid, isGroup);

    if (isGroup) {
      const rec = db.groupRecord(jid);
      if (!rec.sessao) { rec.sessao = session.id; db.save('grupos'); }
      if (ctx.meta?.subject && rec.nome !== ctx.meta.subject) { rec.nome = ctx.meta.subject; db.save('grupos'); }
      if (rec.bloqueado && !ctx.isOwner) return; // grupo banido (.bangp)
      if (config.soGruposAutorizados && !rec.autorizado && !ctx.isOwner) return; // só grupos autorizados (.addgp)
    }

    // Protecções e auto-comprovativo (handleAuto) correm ANTES dos comandos
    if (await runHooks(ctx)) return;

    // ---- comando ----
    const text = ctx.text.trim();
    if (!text.startsWith(prefix)) return;
    const parts = text.slice(prefix.length).trim().split(/\s+/);
    const name = (parts.shift() || '').normalize('NFC').toLowerCase();
    if (!name) return;
    const cmd = registry.commands.map.get(name);
    if (!cmd) return;

    const pre = cmd.aliasArgs?.[name] || [];
    ctx.command = cmd;
    ctx.invoked = name;
    ctx.args = [...pre, ...parts];
    ctx.argText = [...pre, text.slice(prefix.length).trim().slice(name.length).trim()].filter(Boolean).join(' ');

    if (!ctx.isOwner && !rateOk(ctx.number)) { log.warn(`Limite de frequência: ${ctx.number}`); return; }

    const fail = async (texto) => {
      try { if (texto) await ctx.reply(texto); } catch { /* ignora */ }
      await safeReact(session.sock, msg, config.reacoes.falha, session.scheduler);
    };

    if (cmd.groupOnly && !isGroup) return fail(textos.soGrupos);

    // Aluguer: reservado a grupos alugados (dono e comandos "free" não dependem dele)
    if (isGroup && !ctx.isOwner && !cmd.free && !rental.isActive(jid)) {
      const now = Date.now();
      if (now - (warnedGroups.get(jid) || 0) > config.aluguer.avisoSemAluguelCooldownSeg * 1000) {
        warnedGroups.set(jid, now);
        const estado = rental.info(jid).estado;
        const t = ['expirado', 'cancelado'].includes(estado) ? textos.aluguelExpirado(config) : textos.semAluguel(config);
        await ctx.send({ text: t }).catch(() => {});
      }
      return;
    }

    const chk = perms.can(cmd, { isOwner: ctx.isOwner, isAdmin: ctx.isAdmin, gid: isGroup ? jid : null, number: ctx.number });
    if (!chk.ok) return fail(textos.semPermissao);
    if (cmd.botAdmin && isGroup && !ctx.botIsAdmin) return fail(textos.botSemAdmin);

    log.info(`CMD .${name} · ${ctx.number}${isGroup ? ' · ' + jid : ''}`);

    // 1) corre o comando  2) só depois tenta reagir (safeReact nunca lança erro)
    let ok = true;
    try {
      await cmd.run(ctx);
    } catch (e) {
      ok = false;
      log.error(`Erro no comando ${cmd.name}:`, e);
      try { await ctx.reply(e && e.userMessage ? `🩸 ${e.userMessage}` : textos.erroGenerico); } catch { /* ignora */ }
    }
    await safeReact(session.sock, msg, ok ? cmd.reaction : config.reacoes.falha, session.scheduler);
  }

  return async function onUpsert(up) {
    if (up.type !== 'notify') return;
    await Promise.allSettled(up.messages.map(async (m) => {
      try { await processMessage(m); } catch (e) { log.error('Erro ao processar mensagem:', e); }
    }));
  };
}

module.exports = { createHandler };
