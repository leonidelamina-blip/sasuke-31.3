'use strict';
const { DAY, daysLeft, parseDays } = require('../utils/helpers');
const log = require('../utils/logger');

const MAX_HIST = 200;
const MAX_NOTIFY_TRIES = 5;

class Rental {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.timer = null;
    this.running = false;
  }

  get store() { return this.db.get('alugueis').grupos; }
  get(gid) { return this.store[gid] || null; }

  isActive(gid, now = Date.now()) {
    const r = this.get(gid);
    return !!r && r.status === 'ativo' && r.expira > now;
  }

  info(gid, now = Date.now()) {
    const r = this.get(gid);
    if (!r) return { estado: 'nenhum' };
    const activo = r.status === 'ativo' && r.expira > now;
    return {
      estado: activo ? 'ativo' : (r.status === 'ativo' ? 'expirado' : r.status),
      inicio: r.inicio, expira: r.expira, duracaoDias: r.duracaoDias,
      diasRestantes: activo ? daysLeft(r.expira, now) : 0,
      nome: r.nome, historico: r.historico.length,
    };
  }

  listar() {
    return Object.values(this.store).map((r) => ({ ...r, ...this.info(r.gid) }))
      .sort((a, b) => (b.expira || 0) - (a.expira || 0));
  }

  historico(gid) { return this.get(gid)?.historico || []; }

  _checkGid(gid) {
    if (typeof gid !== 'string' || !gid.endsWith('@g.us')) throw new Error('ID de grupo inválido.');
  }
  _checkDias(dias) {
    const d = parseDays(dias);
    if (!d) throw new Error('Número de dias inválido (1 a 3650).');
    return d;
  }
  _hist(r, entry) {
    r.historico.push({ em: Date.now(), ...entry });
    if (r.historico.length > MAX_HIST) r.historico.splice(0, r.historico.length - MAX_HIST);
  }

  /** Cria ou renova. Se já está activo soma dias ao fim actual; se expirou/cancelou, recomeça agora. */
  alugar(gid, dias, por = 'dono', nome = null) {
    this._checkGid(gid);
    const d = this._checkDias(dias);
    const now = Date.now();
    let r = this.get(gid);
    let acao;

    if (r && r.status === 'ativo' && r.expira > now) {
      acao = 'renovar';
      const ant = r.expira;
      r.expira += d * DAY;
      r.duracaoDias += d;
      r.avisoUmDia = false;
      if (nome) r.nome = nome;
      this._hist(r, { acao, dias: d, por, expiraAnterior: ant, expiraNova: r.expira });
    } else {
      acao = r ? 'renovar' : 'alugar';
      const ant = r ? r.expira : null;
      r = this.store[gid] = Object.assign(r || { gid, criadoEm: now, historico: [] }, {
        status: 'ativo', inicio: now, expira: now + d * DAY, duracaoDias: d,
        notificado: true, tentativasNotificar: 0, avisoUmDia: false, tentativasUmDia: 0, nome: nome || (r && r.nome) || null,
      });
      this._hist(r, { acao, dias: d, por, expiraAnterior: ant, expiraNova: r.expira });
    }
    this.db.save('alugueis');
    return { acao, registo: r, diasRestantes: daysLeft(r.expira, now) };
  }

  tirarDias(gid, dias, por = 'dono') {
    this._checkGid(gid);
    const d = this._checkDias(dias);
    const now = Date.now();
    const r = this.get(gid);
    if (!r || r.status !== 'ativo' || r.expira <= now) throw new Error('Este grupo não tem aluguer activo.');
    const ant = r.expira;
    r.expira -= d * DAY;
    r.duracaoDias = Math.max(0, r.duracaoDias - d);
    r.avisoUmDia = false;
    let expirou = false;
    if (r.expira <= now) { r.status = 'expirado'; r.notificado = false; r.tentativasNotificar = 0; expirou = true; }
    this._hist(r, { acao: 'tirardias', dias: d, por, expiraAnterior: ant, expiraNova: r.expira });
    this.db.save('alugueis');
    return { registo: r, expirou, diasRestantes: daysLeft(r.expira, now) };
  }

  anular(gid, por = 'dono') {
    this._checkGid(gid);
    const now = Date.now();
    const r = this.get(gid);
    if (!r || r.status !== 'ativo' || r.expira <= now) throw new Error('Este grupo não tem aluguer activo.');
    const ant = r.expira;
    r.status = 'cancelado';
    r.expira = now;
    r.notificado = true;
    this._hist(r, { acao: 'anular', por, expiraAnterior: ant, expiraNova: now });
    this.db.save('alugueis');
    return r;
  }

  /** Marca como expirados os alugueres vencidos e devolve os que ainda precisam de aviso ao grupo. */
  tick(now = Date.now()) {
    let changed = false;
    for (const r of Object.values(this.store)) {
      if (r.status === 'ativo' && r.expira <= now) {
        r.status = 'expirado'; r.notificado = false; r.tentativasNotificar = 0;
        this._hist(r, { acao: 'expirar', por: 'sistema', expiraAnterior: r.expira, expiraNova: r.expira });
        changed = true;
      }
    }
    if (changed) this.db.save('alugueis');
    return Object.values(this.store).filter((r) => r.status === 'expirado' && r.notificado === false);
  }

  /** Alugueres activos a menos de 1 dia do fim (e com prazo > 1 dia) que ainda não foram avisados. */
  umDia(now = Date.now()) {
    return Object.values(this.store).filter((r) => r.status === 'ativo' && r.expira > now && r.expira - now <= DAY
      && r.expira - r.inicio > DAY + 60000 && !r.avisoUmDia);
  }

  markUmDia(gid) {
    const r = this.get(gid);
    if (r) { r.avisoUmDia = true; this.db.save('alugueis'); }
  }

  markNotified(gid) {
    const r = this.get(gid);
    if (r) { r.notificado = true; this.db.save('alugueis'); }
  }

  /** Verifica periodicamente. onExpire(gid, registo) deve enviar o aviso ao grupo. */
  startWatcher(onExpire, onUmDia) {
    const run = async () => {
      if (this.running) return;
      this.running = true;
      try {
        for (const r of this.tick()) {
          try {
            await onExpire(r.gid, r);
            this.markNotified(r.gid);
          } catch (e) {
            r.tentativasNotificar = (r.tentativasNotificar || 0) + 1;
            if (r.tentativasNotificar >= MAX_NOTIFY_TRIES) { r.notificado = true; log.warn(`Aviso de expiração desistido para ${r.gid}`); }
            this.db.save('alugueis');
            log.warn(`Falha ao avisar expiração de ${r.gid}: ${e.message}`);
          }
        }
        if (onUmDia) {
          for (const r of this.umDia()) {
            try { await onUmDia(r.gid, r); this.markUmDia(r.gid); } catch (e) {
              r.tentativasUmDia = (r.tentativasUmDia || 0) + 1;
              if (r.tentativasUmDia >= MAX_NOTIFY_TRIES) r.avisoUmDia = true;
              this.db.save('alugueis');
              log.warn(`Falha ao avisar "falta 1 dia" de ${r.gid}: ${e.message}`);
            }
          }
        }
      } catch (e) {
        log.error('Erro no verificador de alugueres:', e);
      } finally {
        this.running = false;
      }
    };
    const secs = this.config.aluguer?.verificacaoIntervaloSeg ?? 60;
    this.timer = setInterval(run, secs * 1000);
    this.timer.unref?.();
    this.first = setTimeout(run, 5000);
    this.first.unref?.();
    return run;
  }

  stopWatcher() {
    if (this.timer) clearInterval(this.timer);
    if (this.first) clearTimeout(this.first);
    this.timer = this.first = null;
  }
}

module.exports = { Rental };
