'use strict';
const { resolveTargets, normNum } = require('../utils/targets');
const { jidToNumber, formatDate, sleep } = require('../utils/helpers');
const { userError, botNumbers, tag } = require('../utils/format');

const C = 'Membros';
const G = { categoria: C, groupOnly: true };
const banidos = (db, gid) => { const r = db.groupRecord(gid); if (!r.banidos) r.banidos = {}; return r.banidos; };
const parte = (ctx, jid) => (ctx.meta?.participants || []).find((p) => [p.id, p.lid, p.phoneNumber].filter(Boolean).some((x) => jidToNumber(x) === jidToNumber(jid)));

function protegido(ctx, jid) {
  const n = jidToNumber(jid);
  if (ctx.perms.isOwner([n])) return 'é o proprietário do bot';
  if (botNumbers(ctx).includes(n)) return 'sou eu';
  if (parte(ctx, jid)?.admin) return 'é administrador (rebaixa primeiro)';
  return null;
}
async function mudar(ctx, jid, acao) {
  const r = await ctx.admin((s) => s.groupParticipantsUpdate(ctx.jid, [jid], acao));
  return String(r?.[0]?.status || '200');
}
const alvos = (ctx, msg) => {
  const t = resolveTargets(ctx);
  if (!t.length) throw userError(msg);
  return t;
};
async function relatorio(ctx, titulo, ok, no) {
  const l = [];
  if (ok.length) l.push(`${titulo}: ${ok.map(tag).join(' ')}`);
  if (no.length) l.push('⚠️ Não executado:\n' + no.join('\n'));
  await ctx.send({ text: l.join('\n') || '⚠️ Nada a fazer.', mentions: [...ok, ...no.map((x) => x.jid).filter(Boolean)] });
}

async function remover(ctx, banir) {
  const ts = alvos(ctx, `Marca, responde ou indica o número de quem queres ${banir ? 'banir' : 'remover'}.`);
  const ban = banidos(ctx.db, ctx.jid);
  const ok = []; const no = [];
  for (const jid of ts) {
    const why = protegido(ctx, jid);
    if (why) { no.push(`${tag(jid)} ${why}`); continue; }
    const st = await mudar(ctx, jid, 'remove');
    if (st === '200' || st === '404') {
      ok.push(jid);
      if (banir) ban[jidToNumber(jid)] = { em: Date.now(), por: ctx.number, ...(ctx.motivoBan ? { motivo: ctx.motivoBan } : {}) };
    } else no.push(`${tag(jid)} erro ${st}`);
  }
  if (banir) ctx.db.save('grupos');
  await relatorio(ctx, banir ? (ctx.motivoBan ? `🔐 Banido(s) — ${ctx.motivoBan}` : '🩸 Banido(s)') : '👢 Removido(s)', ok, no);
}

const STATUS_ADD = { 200: 'adicionado ✅', 409: 'já está no grupo', 403: 'a privacidade dele impede (envia o link com .link)', 408: 'saiu recentemente', 401: 'bloqueou o bot', 404: 'número inexistente no WhatsApp' };

module.exports = [
  { ...G, name: 'ban', reaction: '🩸', level: 'admin', botAdmin: true, descricao: 'Bane e remove participantes', run: (ctx) => remover(ctx, true) },
  { ...G, name: 'kick', reaction: '👢', level: 'admin', botAdmin: true, descricao: 'Remove participantes', run: (ctx) => remover(ctx, false) },
  {
    ...G, name: 'add', reaction: '➕', level: 'admin', botAdmin: true, descricao: 'Adiciona participantes pelo número',
    async run(ctx) {
      const nums = ctx.args.map(normNum).filter(Boolean);
      if (!nums.length) throw userError('Uso: .add 84xxxxxxx [outro número]');
      const ban = banidos(ctx.db, ctx.jid);
      const l = [];
      for (const n of nums.slice(0, 10)) {
        if (ban[n]) { l.push(`+${n}: está banido (usa .unban primeiro)`); continue; }
        const st = await mudar(ctx, n + '@s.whatsapp.net', 'add');
        l.push(`+${n}: ${STATUS_ADD[st] || 'falhou (código ' + st + ')'}`);
      }
      await ctx.reply('➕ Resultado:\n' + l.join('\n'));
    },
  },
  {
    ...G, name: 'promover', reaction: '👑', level: 'admin', botAdmin: true, descricao: 'Promove a administrador',
    async run(ctx) {
      const ts = alvos(ctx, 'Marca, responde ou indica o número de quem queres promover.');
      const ok = []; const no = [];
      for (const j of ts) { const st = await mudar(ctx, j, 'promote'); (st === '200' ? ok : no).push(st === '200' ? j : `${tag(j)} erro ${st}`); }
      await relatorio(ctx, '👑 Promovido(s)', ok, no);
    },
  },
  {
    ...G, name: 'rebaixar', reaction: '⬇️', level: 'admin', botAdmin: true, descricao: 'Remove a administração',
    async run(ctx) {
      const ts = alvos(ctx, 'Marca, responde ou indica o número de quem queres rebaixar.');
      const ok = []; const no = [];
      for (const j of ts) {
        if (ctx.perms.isOwner([jidToNumber(j)])) { no.push(`${tag(j)} é o proprietário do bot`); continue; }
        const st = await mudar(ctx, j, 'demote'); (st === '200' ? ok : no).push(st === '200' ? j : `${tag(j)} erro ${st}`);
      }
      await relatorio(ctx, '⬇️ Rebaixado(s)', ok, no);
    },
  },
  {
    ...G, name: 'mute', reaction: '🔇', level: 'admin', descricao: 'Silencia participantes (apaga as suas mensagens)',
    async run(ctx) {
      const ts = alvos(ctx, 'Marca, responde ou indica o número de quem queres silenciar.');
      const cfg = ctx.db.groupConfig(ctx.jid);
      const ok = []; const no = [];
      for (const j of ts) {
        const why = protegido(ctx, j);
        if (why) { no.push(`${tag(j)} ${why}`); continue; }
        const n = jidToNumber(j);
        if (!cfg.mutados.includes(n)) cfg.mutados.push(n);
        ok.push(j);
      }
      ctx.db.save('configuracoes');
      await relatorio(ctx, '🔇 Silenciado(s)', ok, no);
      if (ok.length && !ctx.botIsAdmin) await ctx.reply('⚠️ Não sou administrador: não consigo apagar as mensagens deles.');
    },
  },
  {
    ...G, name: 'unmute', reaction: '🔊', level: 'admin', descricao: 'Remove o silenciamento',
    async run(ctx) {
      const ts = alvos(ctx, 'Marca, responde ou indica o número de quem queres dessilenciar.');
      const cfg = ctx.db.groupConfig(ctx.jid);
      cfg.mutados = cfg.mutados.filter((n) => !ts.some((j) => jidToNumber(j) === n));
      ctx.db.save('configuracoes');
      await relatorio(ctx, '🔊 Dessilenciado(s)', ts, []);
    },
  },
  {
    ...G, name: 'banlist', reaction: '📋', level: 'admin', descricao: 'Lista os banidos do grupo',
    async run(ctx) {
      const e = Object.entries(banidos(ctx.db, ctx.jid));
      if (!e.length) return ctx.reply('📋 Não há banidos neste grupo.');
      await ctx.reply(`🩸 Banidos (${e.length}):\n` + e.map(([n, v], i) => `${i + 1}. +${n} — ${formatDate(v.em, ctx.config.fusoHorario)}`).join('\n'));
    },
  },
  {
    ...G, name: 'unban', reaction: '♻️', level: 'admin', descricao: 'Remove alguém da lista de banidos',
    async run(ctx) {
      const ts = resolveTargets(ctx);
      if (!ts.length) throw userError('Uso: .unban 84xxxxxxx');
      const ban = banidos(ctx.db, ctx.jid);
      const feitos = ts.filter((j) => { const n = jidToNumber(j); const h = !!ban[n]; delete ban[n]; return h; });
      ctx.db.save('grupos');
      if (!feitos.length) throw userError('Essa pessoa não está na lista de banidos.');
      await relatorio(ctx, '♻️ Desbanido(s)', feitos, []);
    },
  },
  {
    ...G, name: 'admins', reaction: '👑', descricao: 'Lista os administradores',
    async run(ctx) {
      const m = await ctx.refreshMeta();
      const a = m.participants.filter((p) => p.admin);
      await ctx.send({ text: `👑 Administradores (${a.length}):\n` + a.map((p) => `${p.admin === 'superadmin' ? '👑' : '⚡'} ${tag(p.id)}`).join('\n'), mentions: a.map((p) => p.id) });
    },
  },
  {
    ...G, name: 'membros', reaction: '👥', descricao: 'Mostra a contagem e a lista de membros',
    async run(ctx) {
      const m = await ctx.refreshMeta();
      const total = m.participants.length; const adm = m.participants.filter((p) => p.admin).length;
      const lista = m.participants.slice(0, 60).map((p) => '• +' + jidToNumber(p.phoneNumber || p.id));
      await ctx.reply(`👥 Total: ${total}\n👑 Administradores: ${adm}\n⚫ Membros: ${total - adm}\n\n${lista.join('\n')}${total > 60 ? `\n…e mais ${total - 60}` : ''}`);
    },
  },
  {
    ...G, name: 'online', reaction: '🟢', descricao: 'Mostra quem está online (só quem a privacidade deixa ver)',
    async run(ctx) {
      const m = await ctx.refreshMeta();
      const lista = m.participants.slice(0, 60).map((p) => p.id);
      const visto = new Map();
      const h = (u) => { for (const [j, p] of Object.entries(u.presences || {})) visto.set(j, p.lastKnownPresence); };
      ctx.sock.ev.on('presence.update', h);
      try {
        for (const j of lista) { try { await ctx.sock.presenceSubscribe(j); } catch { /* ignora */ } await sleep(150); }
        await sleep(5000);
      } finally { ctx.sock.ev.off('presence.update', h); }
      const on = [...visto.entries()].filter(([, s]) => ['available', 'composing', 'recording'].includes(s)).map(([j]) => j);
      const txt = on.length ? on.map((j) => `🟢 ${tag(j)}`).join('\n') : 'Ninguém respondeu como online.';
      await ctx.send({
        text: `🟢 Online agora (${on.length}) — verificados ${lista.length} membros:\n${txt}\n\nℹ️ O WhatsApp não fornece uma lista oficial. Só aparecem pessoas cuja privacidade permite ver o estado online.`,
        mentions: on,
      });
    },
  },
];
