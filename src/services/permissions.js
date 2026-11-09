'use strict';
const { jidToNumber } = require('../utils/helpers');

const LEVELS = { membro: 1, cliente: 2, admin: 3, dono: 4 };

class Permissions {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.ownerNumbers = new Set([
      config.dono.internacional,
      config.dono.numero,
      ...(config.dono.lids || []),
    ].map((n) => jidToNumber(n)).filter(Boolean));
  }

  /** `numbers` = números/LIDs possíveis do remetente. */
  isOwner(numbers) {
    return (Array.isArray(numbers) ? numbers : [numbers]).some((n) => this.ownerNumbers.has(jidToNumber(n)));
  }

  // ---- clientes (por grupo) ----
  _clientes(gid) {
    const root = this.db.get('usuarios').clientes;
    if (!Array.isArray(root[gid])) root[gid] = [];
    return root[gid];
  }
  isCliente(gid, number) { return !!gid && this._clientes(gid).includes(number); }
  listClientes(gid) { return [...this._clientes(gid)]; }
  addCliente(gid, number) {
    const l = this._clientes(gid);
    if (l.includes(number)) return false;
    l.push(number); this.db.save('usuarios'); return true;
  }
  removeCliente(gid, number) {
    const l = this._clientes(gid);
    const i = l.indexOf(number);
    if (i < 0) return false;
    l.splice(i, 1); this.db.save('usuarios'); return true;
  }

  // ---- níveis ----
  level({ isOwner, isAdmin, gid, number }) {
    if (isOwner) return 'dono';
    if (isAdmin) return 'admin';
    if (gid && this.isCliente(gid, number)) return 'cliente';
    return 'membro';
  }

  /** Nível exigido por um comando neste grupo, tendo em conta .liberar / .modolivre. */
  requiredLevel(cmd, gid) {
    const base = cmd.level || 'membro';
    if (base === 'dono' || !gid) return base;
    const cfg = this.db.groupConfig(gid);
    const lib = cfg.liberados[cmd.name];
    if (lib && LEVELS[lib] && lib !== 'dono' && !cmd.nuncaLiberar) return lib;
    if (cfg.modoLivre && base === 'admin' && !cmd.nuncaLiberar) return 'membro';
    return base;
  }

  can(cmd, ctx) {
    const level = this.level(ctx);
    const required = this.requiredLevel(cmd, ctx.gid);
    return { ok: LEVELS[level] >= LEVELS[required], level, required };
  }

  // ---- gestão de liberações (usado pelos comandos .liberar etc. na Parte 4) ----
  setLiberado(gid, cmdName, level) {
    if (!LEVELS[level] || level === 'dono') throw new Error('Nível inválido (membro, cliente ou admin).');
    this.db.groupConfig(gid).liberados[cmdName] = level;
    this.db.save('configuracoes');
  }
  removeLiberado(gid, cmdName) {
    const l = this.db.groupConfig(gid).liberados;
    const had = cmdName in l; delete l[cmdName];
    if (had) this.db.save('configuracoes');
    return had;
  }
  setModoLivre(gid, on) { this.db.groupConfig(gid).modoLivre = !!on; this.db.save('configuracoes'); }
  resetGrupo(gid) {
    const c = this.db.groupConfig(gid);
    c.liberados = {}; c.modoLivre = false; this.db.save('configuracoes');
  }
}

module.exports = { Permissions, LEVELS };
