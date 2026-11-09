'use strict';
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const pino = require('pino');
const log = require('../utils/logger');
const { sleep } = require('../utils/helpers');
const { MessageScheduler } = require('./messageScheduler');
const lock = require('./lock');
const { GroupCache } = require('./groupCache');
const { createHandler } = require('../handlers/messageHandler');

const baileysLogger = pino({ level: 'silent' });

/** Eventos emitidos: 'pairing'(código) · 'qr'(string) · 'open' · 'close'(código) */
class Session extends EventEmitter {
  /**
   * @param {string} id        identificador (pasta em auth/)
   * @param {object} services  { config, db, perms, rental, registry, sessions }
   * @param {object} opts      { phone } -> Pairing Code; sem phone -> QR
   */
  constructor(id, services, opts = {}) {
    super();
    this.id = id;
    this.services = services;
    this.phone = opts.phone ? String(opts.phone).replace(/\D/g, '') : null;
    this.authDir = path.resolve(services.config.authDir, id);
    this.scheduler = new MessageScheduler(services.config.scheduler, id);
    this.groups = new GroupCache();
    this.sock = null;
    this.status = 'parado';
    this.lastQr = null;
    this.retries = 0;
    this.stopping = false;
    this.reconnectTimer = null;
    this.handler = createHandler({ ...services, session: this });
  }

  async start() {
    if (this.scheduler.stopped) this.scheduler = new MessageScheduler(this.services.config.scheduler, this.id);
    this.stopping = false;
    await this._connect();
  }

  async _connect() {
    if (this.stopping) return;
    const baileys = require('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = baileys;

    if (!this.releaseLock) this.releaseLock = await lock.adquirir(this.authDir);
    fs.mkdirSync(this.authDir, { recursive: true, mode: 0o700 });
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    let version;
    try { ({ version } = await fetchLatestBaileysVersion()); } catch { log.warn(`[${this.id}] Versão do WhatsApp Web não obtida, a usar a padrão.`); }

    this._dropSocket();
    this.status = 'a ligar';
    const sock = makeWASocket({
      ...(version ? { version } : {}),
      logger: baileysLogger,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, baileysLogger) },
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      cachedGroupMetadata: async (jid) => this.groups.peek(jid),
      getMessage: async () => undefined,
    });
    this.sock = sock;
    this.scheduler.setSocket(sock);
    this.scheduler.setReady(false);

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => this._onConnection(u, sock));
    sock.ev.on('messages.upsert', (up) => {
      if (sock !== this.sock) return;
      this.handler(up).catch((e) => log.error(`[${this.id}] messages.upsert:`, e));
    });
    sock.ev.on('groups.update', (updates) => {
      if (sock !== this.sock) return;
      for (const u of updates || []) {
        if (!u.id) continue;
        this.groups.invalidate(u.id);
        this._dispatch('groups.update', u);
      }
    });
    sock.ev.on('group-participants.update', (data) => {
      if (sock !== this.sock) return;
      if (data?.id) this.groups.invalidate(data.id);
      this._dispatch('group-participants.update', data);
    });

    if (!state.creds.registered && this.phone) this._requestPairing(sock, state);
  }

  _dispatch(event, data) {
    const env = { session: this, sock: this.sock, ...this.services, scheduler: this.scheduler, groups: this.groups };
    for (const h of this.services.registry.events) {
      if (h.event !== event) continue;
      Promise.resolve().then(() => h.run(env, data)).catch((e) => log.error(`Evento "${event}" falhou:`, e));
    }
  }

  async _requestPairing(sock, state) {
    for (let i = 1; i <= 3; i++) {
      try {
        await sleep(3000);
        if (sock !== this.sock || state.creds.registered || this.stopping) return;
        const raw = await sock.requestPairingCode(this.phone);
        const code = String(raw).match(/.{1,4}/g)?.join('-') || raw;
        log.info(`🔑 [${this.id}] CÓDIGO DE EMPARELHAMENTO: ${code}`);
        console.log(`\n  ===== CÓDIGO DE EMPARELHAMENTO: ${code} =====`);
        console.log('  WhatsApp > Aparelhos ligados > Ligar com número de telefone\n');
        this.emit('pairing', code);
        return;
      } catch (e) {
        log.warn(`[${this.id}] Pairing Code (tentativa ${i}/3): ${e.message}`);
      }
    }
    log.error(`[${this.id}] Não foi possível obter o Pairing Code. Reinicia o bot e tenta de novo.`);
  }

  _onConnection(update, sock) {
    if (sock !== this.sock) return; // socket antigo
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.lastQr = qr;
      this.emit('qr', qr);
      if (!this.phone && this.id === this.services.config.sessaoPrincipal) {
        try { require('qrcode-terminal').generate(qr, { small: true }); } catch { log.warn('qrcode-terminal indisponível.'); }
      }
    }

    if (connection === 'open') {
      this.status = 'online';
      this.retries = 0;
      this.lastQr = null;
      this.scheduler.setReady(true);
      log.info(`✅ [${this.id}] Ligado ao WhatsApp como ${sock.user?.id || '?'}`);
      this.emit('open');
      return;
    }

    if (connection === 'close') {
      this.scheduler.setReady(false);
      if (this.stopping) { this.status = 'parado'; return; }

      const code = lastDisconnect?.error?.output?.statusCode;
      const { DisconnectReason } = require('@whiskeysockets/baileys');
      log.warn(`[${this.id}] Ligação fechada (código ${code ?? '?'}): ${lastDisconnect?.error?.message || ''}`);
      this.emit('close', code);

      if (code === DisconnectReason.loggedOut) {
        this.status = 'deslogado';
        log.error(`[${this.id}] Sessão terminada no telemóvel. Apaga a pasta auth/${this.id} e inicia de novo para emparelhar.`);
        return;
      }
      if (code === DisconnectReason.connectionReplaced) {
        this.status = 'substituido';
        log.error(`[${this.id}] Sessão aberta noutro local. Não vou reconectar para evitar conflito.`);
        return;
      }
      if (code === DisconnectReason.badSession) {
        this.status = 'sessao-invalida';
        log.error(`[${this.id}] Sessão inválida. Apaga a pasta auth/${this.id} e emparelha de novo.`);
        return;
      }
      if (code === DisconnectReason.restartRequired) return this._scheduleReconnect(500);

      this.retries++;
      this._scheduleReconnect(Math.min(60000, 2000 * 2 ** Math.min(this.retries - 1, 5)));
    }
  }

  _scheduleReconnect(ms) {
    if (this.stopping) return;
    this.status = 'a reconectar';
    clearTimeout(this.reconnectTimer);
    log.info(`[${this.id}] A reconectar em ${Math.round(ms / 1000)}s...`);
    this.reconnectTimer = setTimeout(() => {
      this._connect().catch((e) => {
        log.error(`[${this.id}] Falha ao reconectar:`, e);
        this.retries++;
        this._scheduleReconnect(Math.min(60000, 2000 * 2 ** Math.min(this.retries, 5)));
      });
    }, ms);
  }

  _dropSocket() {
    if (!this.sock) return;
    const old = this.sock;
    this.sock = null; // listeners do socket antigo passam a ser ignorados
    try { old.end(undefined); } catch { /* ignora */ }
  }

  async stop() {
    this.stopping = true;
    clearTimeout(this.reconnectTimer);
    this.scheduler.stop();
    this._dropSocket();
    this.status = 'parado';
    if (this.releaseLock) { this.releaseLock(); this.releaseLock = null; }
  }

  info() {
    return { id: this.id, estado: this.status, numero: this.phone, fila: this.scheduler.stats() };
  }
}

class SessionManager {
  constructor(services) {
    this.services = services;
    this.sessions = new Map();
  }

  get db() { return this.services.db; }
  _persisted() {
    const g = this.db.get('configuracoes').global;
    if (!Array.isArray(g.sessoes)) g.sessoes = [];
    return g.sessoes;
  }
  _savePersisted() { this.db.save('configuracoes'); }

  /** Cria e arranca uma sessão. persist=true guarda-a para arrancar nos próximos reinícios. */
  async add(id, opts = {}, { persist = true } = {}) {
    if (this.sessions.has(id)) throw new Error(`A sessão "${id}" já existe.`);
    const s = new Session(id, this.services, opts);
    this.sessions.set(id, s);
    if (persist) this.persist(id, opts.phone || null);
    await s.start();
    return s;
  }

  persist(id, phone) {
    if (id === this.services.config.sessaoPrincipal) return;
    const l = this._persisted();
    const e = l.find((x) => x.id === id);
    if (e) { e.phone = phone ?? e.phone; e.parada = false; } else l.push({ id, phone: phone || null, parada: false });
    this._savePersisted();
  }

  async stop(id) {
    const s = this.sessions.get(id);
    if (!s) throw new Error('Sessão inexistente.');
    await s.stop();
    const e = this._persisted().find((x) => x.id === id);
    if (e) { e.parada = true; this._savePersisted(); }
  }

  async resume(id) {
    const s = this.sessions.get(id);
    if (!s) throw new Error('Sessão inexistente.');
    await s.start();
    const e = this._persisted().find((x) => x.id === id);
    if (e) { e.parada = false; this._savePersisted(); }
    return s;
  }

  async remove(id, { apagarAuth = false } = {}) {
    const s = this.sessions.get(id);
    if (s) { await s.stop(); this.sessions.delete(id); }
    const l = this._persisted();
    const i = l.findIndex((x) => x.id === id);
    if (i >= 0) { l.splice(i, 1); this._savePersisted(); }
    if (apagarAuth) fs.rmSync(path.resolve(this.services.config.authDir, id), { recursive: true, force: true });
  }

  /** Arranca as sessões guardadas (excepto as paradas). */
  async restore() {
    for (const e of this._persisted()) {
      if (e.parada || this.sessions.has(e.id)) continue;
      try { await this.add(e.id, { phone: e.phone }, { persist: false }); } catch (err) { log.error(`Sessão ${e.id}:`, err); }
    }
  }

  get(id) { return this.sessions.get(id) || null; }
  principal() { return this.get(this.services.config.sessaoPrincipal); }
  list() { return [...this.sessions.values()].map((s) => s.info()); }
  async stopAll() { await Promise.allSettled([...this.sessions.values()].map((s) => s.stop())); }
}

module.exports = { Session, SessionManager };
