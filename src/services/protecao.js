'use strict';
const { jidToNumber } = require('../utils/helpers');
const { onOff, userError } = require('../utils/format');

const MAX_OCORRENCIAS = 300;

class Warnings {
  constructor(db) { this.db = db; }
  _g(gid) { return this.db.groupOf('advertencias', gid, () => ({ usuarios: {}, ocorrencias: [] })); }

  add(gid, number, motivo, max, acao = 'aviso') {
    const g = this._g(gid);
    const u = g.usuarios[number] || (g.usuarios[number] = { count: 0, historico: [] });
    u.count++;
    u.historico.push({ motivo, em: Date.now() });
    if (u.historico.length > 50) u.historico.shift();
    g.ocorrencias.push({ numero: number, motivo, acao, em: Date.now() });
    if (g.ocorrencias.length > MAX_OCORRENCIAS) g.ocorrencias.shift();
    this.db.save('advertencias');
    return { count: u.count, max, atingiu: u.count >= max };
  }
  get(gid, number) { return this._g(gid).usuarios[number] || { count: 0, historico: [] }; }
  reset(gid, number) {
    const g = this._g(gid);
    const had = !!g.usuarios[number];
    delete g.usuarios[number];
    if (had) this.db.save('advertencias');
    return had;
  }
  ocorrencia(gid, number, motivo, acao) {
    const g = this._g(gid);
    g.ocorrencias.push({ numero: number, motivo, acao, em: Date.now() });
    if (g.ocorrencias.length > MAX_OCORRENCIAS) g.ocorrencias.shift();
    this.db.save('advertencias');
  }
}

const cache = new WeakMap();
function warnings(db) {
  let w = cache.get(db);
  if (!w) { w = new Warnings(db); cache.set(db, w); }
  return w;
}

const prot = (db, gid, name) => db.groupConfig(gid).protecoes[name] || null;
const ativo = (db, gid, name) => !!prot(db, gid, name)?.ativo;
function setProt(db, gid, name, patch) {
  const p = db.groupConfig(gid).protecoes;
  p[name] = { ...(p[name] || {}), ...patch };
  db.save('configuracoes');
  return p[name];
}
const isento = (ctx) => ctx.isAdmin || ctx.isOwner;

/** Aplica a medida: apaga a mensagem (se possível), regista aviso e remove ao atingir o limite (se .automover). */
async function punir(ctx, motivo, { apagar = true } = {}) {
  const { jid, msg, number, db } = ctx;
  const cfg = db.groupConfig(jid);
  if (apagar && ctx.botIsAdmin) await ctx.admin((s) => s.sendMessage(jid, { delete: msg.key })).catch(() => {});
  const max = cfg.maxAvisos || 3;
  const w = warnings(db).add(jid, number, motivo, max);
  let texto = `🩸 @${number} ${motivo}\n⚠️ Aviso ${w.count}/${max}`;
  if (w.atingiu) {
    if (ativo(db, jid, 'automover') && ctx.botIsAdmin) {
      try {
        await ctx.admin((s) => s.groupParticipantsUpdate(jid, [ctx.sender], 'remove'));
        warnings(db).reset(jid, number);
        warnings(db).ocorrencia(jid, number, 'removido por excesso de avisos', 'remocao');
        texto += '\n🚫 Removido por atingir o limite de avisos.';
      } catch {
        texto += '\n⚠️ Limite atingido, mas não consegui remover. Um administrador deve agir.';
      }
    } else {
      texto += '\n⚠️ Limite atingido. Um administrador deve agir.';
    }
  }
  await ctx.send({ text: texto, mentions: [ctx.sender] }, { quoted: null }).catch(() => {});
}

/** Fábrica dos comandos on/off de protecção. extra(ctx, ligar) pode devolver campos adicionais. */
function makeToggle({ name, reaction, categoria = 'Protecções', descricao, extra, precisaAdmin = true }) {
  return {
    name, categoria, descricao, reaction, level: 'admin', groupOnly: true, nuncaLiberar: true,
    async run(ctx) {
      const st = onOff(ctx.args[0]);
      const cur = prot(ctx.db, ctx.jid, name);
      if (st === null) {
        const det = cur && Object.keys(cur).filter((k) => k !== 'ativo').map((k) => `${k}: ${JSON.stringify(cur[k])}`).join(' · ');
        return ctx.reply(`🛡️ .${name}: ${cur?.ativo ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}${det ? '\n' + det : ''}\n\nUsa .${name} on ou .${name} off`);
      }
      const patch = { ativo: st };
      if (extra && st) Object.assign(patch, await extra(ctx));
      setProt(ctx.db, ctx.jid, name, patch);
      let t = `🛡️ .${name} ${st ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}`;
      if (st && precisaAdmin && !ctx.botIsAdmin) t += '\n⚠️ Não sou administrador: não consigo apagar mensagens nem remover membros.';
      await ctx.reply(t);
    },
  };
}

module.exports = { Warnings, warnings, prot, ativo, setProt, isento, punir, makeToggle, jidToNumber, userError };
