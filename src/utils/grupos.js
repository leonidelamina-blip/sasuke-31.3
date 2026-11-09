'use strict';
const { userError } = require('./format');

/** Grupos conhecidos (grupos.json + alugueis.json), ordenados por nome — a numeração usada em .alugueis. */
async function conhecidos(ctx, { refresh = false } = {}) {
  if (refresh) {
    try {
      const all = await ctx.sock.groupFetchAllParticipating();
      for (const g of Object.values(all || {})) {
        const rec = ctx.db.groupRecord(g.id);
        if (!rec.sessao) rec.sessao = ctx.session.id;
        if (g.subject) rec.nome = g.subject;
        if (g.participants) rec.membros = g.participants.length;
      }
      ctx.db.save('grupos');
    } catch { /* usa o que já existe */ }
  }
  const map = new Map();
  for (const [gid, r] of Object.entries(ctx.db.get('grupos').grupos)) map.set(gid, { gid, nome: r.nome || null, bloqueado: !!r.bloqueado });
  for (const gid of Object.keys(ctx.db.get('alugueis').grupos)) {
    if (!map.has(gid)) map.set(gid, { gid, nome: ctx.rental.get(gid)?.nome || null, bloqueado: false });
  }
  return [...map.values()].sort((a, b) => (a.nome || a.gid).localeCompare(b.nome || b.gid, 'pt'));
}

async function resolverGrupo(ctx, token, { refresh = false } = {}) {
  if (!token) {
    if (ctx.isGroup) return ctx.jid;
    throw userError('Indica o número do grupo (vê a lista com .alugueis) ou o ID completo.');
  }
  if (String(token).endsWith('@g.us')) return token;
  if (/^\d{1,4}$/.test(token)) {
    const l = await conhecidos(ctx, { refresh });
    const g = l[Number(token) - 1];
    if (!g) throw userError('Número de grupo inexistente. Usa .alugueis para ver a lista.');
    return g.gid;
  }
  throw userError('Grupo inválido. Usa o número da lista (.alugueis) ou o ID terminado em @g.us.');
}

/** Sessão que gere o grupo (ou a actual). */
function sessaoDe(ctx, gid) {
  const rec = ctx.db.get('grupos').grupos[gid];
  const sm = ctx.session.services.sessions;
  return (rec?.sessao && sm?.get(rec.sessao)) || ctx.session;
}

module.exports = { conhecidos, resolverGrupo, sessaoDe };
