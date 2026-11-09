'use strict';

class GroupCache {
  constructor(ttlMs = 60000) {
    this.ttl = ttlMs;
    this.map = new Map();
  }

  /** Metadados do grupo (cache de 60s). force=true ignora a cache. */
  async get(sock, gid, force = false) {
    const c = this.map.get(gid);
    if (!force && c && Date.now() - c.ts < this.ttl) return c.meta;
    const meta = await sock.groupMetadata(gid);
    this.map.set(gid, { meta, ts: Date.now() });
    return meta;
  }

  peek(gid) { return this.map.get(gid)?.meta; }
  set(gid, meta) { this.map.set(gid, { meta, ts: Date.now() }); }
  invalidate(gid) { this.map.delete(gid); }
  clear() { this.map.clear(); }
}

module.exports = { GroupCache };
