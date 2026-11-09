'use strict';
/**
 * Human Response System — fila central de envio.
 *
 * Objectivo: organizar e limitar o envio (intervalos por tipo, concorrência máxima,
 * sem duplicados, retentativas limitadas, cancelamento). NÃO esconde a automação nem
 * contorna sistemas do WhatsApp: é apenas controlo de frequência e de falhas.
 */
const { sleep } = require('../utils/helpers');
const log = require('../utils/logger');

const DEFAULTS = {
  intervals: { text: 800, react: 250, image: 1500, video: 2500, admin: 1200, long: 1800, default: 800 },
  maxConcurrent: 3,
  globalGapMs: 300,
  maxRetries: 3,
  retryBaseMs: 1500,
  dedupeWindowMs: 3000,
  typing: true,
  typingMaxMs: 2000,
  maxQueuePerChat: 50,
  readyTimeoutMs: 30000,
};

function noRetry(msg) { const e = new Error(msg); e.noRetry = true; return e; }

function isRetryable(err) {
  if (!err || err.noRetry) return false;
  const code = err.output?.statusCode ?? err.statusCode;
  return ![400, 401, 403, 404].includes(code);
}

class MessageScheduler {
  constructor(cfg = {}, id = 'principal') {
    this.id = id;
    this.cfg = { ...DEFAULTS, ...cfg, intervals: { ...DEFAULTS.intervals, ...(cfg.intervals || {}) } };
    this.sock = null;
    this.ready = false;
    this.stopped = false;
    this.chats = new Map();   // jid -> { items, running, last }
    this.recent = new Map();  // chave de deduplicação -> timestamp
    this.waiters = [];
    this.active = 0;
    this.nextGlobal = 0;
    this.seq = 0;
    this.stat = { enviados: 0, falhas: 0, duplicados: 0, cancelados: 0 };

    this.cleaner = setInterval(() => this._cleanup(), 60000);
    this.cleaner.unref?.();
  }

  setSocket(sock) { this.sock = sock; }
  setReady(v) { this.ready = !!v; }

  // ---------- API pública ----------

  /** Coloca uma operação na fila do chat. `exec(sock)` é chamada quando chegar a vez. */
  enqueue(jid, kind, exec, opts = {}) {
    return new Promise((resolve, reject) => {
      if (this.stopped) return reject(noRetry('scheduler parado'));
      if (!jid || typeof exec !== 'function') return reject(noRetry('tarefa inválida'));

      if (opts.dedupeKey) {
        const k = `${jid}|${opts.dedupeKey}`;
        const now = Date.now();
        const t = this.recent.get(k);
        if (t && now - t < this.cfg.dedupeWindowMs) { this.stat.duplicados++; return resolve(null); }
        this.recent.set(k, now);
      }

      let chat = this.chats.get(jid);
      if (!chat) { chat = { items: [], running: false, last: 0 }; this.chats.set(jid, chat); }
      if (chat.items.length >= this.cfg.maxQueuePerChat) return reject(noRetry('fila do chat cheia'));

      chat.items.push({ id: ++this.seq, jid, kind, exec, opts, resolve, reject, cancelled: false, tries: 0 });
      this._drain(jid);
    });
  }

  /** Operações administrativas (promover, remover...) — o chamador aguarda a conclusão. */
  run(jid, fn, opts = {}) { return this.enqueue(jid, 'admin', fn, { typing: false, ...opts }); }

  /** Envia conteúdo Baileys (texto, imagem, vídeo...). */
  send(jid, content, opts = {}) {
    if (!content || typeof content !== 'object') return Promise.reject(noRetry('conteúdo inválido'));
    const kind = opts.kind || this._inferKind(content);
    const text = content.text || content.caption || '';
    let dedupeKey = opts.dedupeKey;
    if (dedupeKey === undefined && text) dedupeKey = `${kind}:${text}:${opts.quoted?.key?.id || ''}`;
    return this.enqueue(
      jid, kind,
      (sock) => sock.sendMessage(jid, content, opts.quoted ? { quoted: opts.quoted } : undefined),
      { dedupeKey: dedupeKey || undefined, typingText: text, typing: opts.typing, validate: opts.validate },
    );
  }

  /** Reacção a uma mensagem (key = msg.key). */
  react(jid, key, emoji) {
    if (!key || !emoji) return Promise.reject(noRetry('reacção inválida'));
    return this.enqueue(
      jid, 'react',
      (sock) => sock.sendMessage(jid, { react: { text: emoji, key } }),
      { dedupeKey: `R:${key.id}:${emoji}`, typing: false },
    );
  }

  cancelChat(jid, motivo = 'cancelada') {
    const chat = this.chats.get(jid);
    if (!chat) return 0;
    const n = chat.items.length;
    for (const t of chat.items) { t.cancelled = true; t.reject(noRetry(motivo)); this.stat.cancelados++; }
    chat.items.length = 0;
    return n;
  }

  cancelAll(motivo = 'cancelada') {
    let n = 0;
    for (const jid of this.chats.keys()) n += this.cancelChat(jid, motivo);
    return n;
  }

  stop() { this.stopped = true; this.cancelAll('scheduler parado'); clearInterval(this.cleaner); }

  stats() {
    let pendentes = 0;
    for (const c of this.chats.values()) pendentes += c.items.length;
    return { ...this.stat, pendentes, activos: this.active, chats: this.chats.size, pronto: this.ready };
  }

  // ---------- interno ----------

  _inferKind(c) {
    if (c.image) return 'image';
    if (c.video) return 'video';
    if (c.text && c.text.length > 700) return 'long';
    return 'text';
  }

  _drain(jid) {
    const chat = this.chats.get(jid);
    if (!chat || chat.running) return;
    chat.running = true;
    (async () => {
      try {
        while (chat.items.length) {
          const task = chat.items.shift();
          if (task.cancelled) continue;
          if (typeof task.opts.validate === 'function' && !task.opts.validate()) {
            this.stat.cancelados++;
            task.reject(noRetry('tarefa inválida (cancelada)'));
            continue;
          }
          await this._execute(chat, task);
        }
      } finally {
        chat.running = false;
      }
    })();
  }

  async _execute(chat, task) {
    const gap = this.cfg.intervals[task.kind] ?? this.cfg.intervals.default;
    for (;;) {
      let slot = false;
      try {
        const wait = chat.last + gap - Date.now();
        if (wait > 0) await sleep(wait);
        await this._waitReady();
        if (task.cancelled) throw noRetry('cancelada');
        if (this._wantsTyping(task)) await this._typing(task); // antes de ocupar vaga global
        await this._acquire(); slot = true;
        if (task.cancelled) throw noRetry('cancelada');
        const res = await task.exec(this.sock);
        chat.last = Date.now();
        this.stat.enviados++;
        return task.resolve(res);
      } catch (err) {
        task.tries++;
        if (task.cancelled || task.tries > this.cfg.maxRetries || !isRetryable(err)) {
          chat.last = Date.now();
          this.stat.falhas++;
          return task.reject(err);
        }
        log.warn(`[scheduler:${this.id}] tentativa ${task.tries}/${this.cfg.maxRetries} falhou (${task.kind}): ${err.message}`);
        await sleep(this.cfg.retryBaseMs * 2 ** (task.tries - 1));
      } finally {
        if (slot) this._release();
      }
    }
  }

  async _waitReady() {
    const t0 = Date.now();
    while (!this.ready) {
      if (this.stopped) throw noRetry('scheduler parado');
      if (Date.now() - t0 > this.cfg.readyTimeoutMs) throw noRetry('sem ligação ao WhatsApp');
      await sleep(250);
    }
  }

  _wantsTyping(task) {
    return this.cfg.typing && task.opts.typing !== false && ['text', 'long'].includes(task.kind) && !!this.sock;
  }

  async _typing(task) {
    const len = (task.opts.typingText || '').length;
    const ms = Math.min(this.cfg.typingMaxMs, 300 + len * 10);
    try {
      await this.sock.sendPresenceUpdate('composing', task.jid);
      await sleep(ms);
      await this.sock.sendPresenceUpdate('paused', task.jid);
    } catch { /* indicador de escrita é opcional */ }
  }

  async _acquire() {
    while (this.active >= this.cfg.maxConcurrent) await new Promise((r) => this.waiters.push(r));
    this.active++;
    const now = Date.now();
    const wait = this.nextGlobal - now;
    this.nextGlobal = Math.max(now, this.nextGlobal) + this.cfg.globalGapMs;
    if (wait > 0) await sleep(wait);
  }

  _release() {
    this.active--;
    const w = this.waiters.shift();
    if (w) w();
  }

  _cleanup() {
    const now = Date.now();
    for (const [k, t] of this.recent) if (now - t > this.cfg.dedupeWindowMs * 4) this.recent.delete(k);
    for (const [jid, c] of this.chats) if (!c.running && !c.items.length && now - c.last > 300000) this.chats.delete(jid);
  }
}

module.exports = { MessageScheduler };
