'use strict';
const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

// Estrutura de raiz de cada ficheiro. Campos em falta são preenchidos (migração).
const SCHEMAS = {
  grupos: { grupos: {} },
  alugueis: { grupos: {} },
  usuarios: { usuarios: {}, clientes: {} },
  advertencias: { grupos: {} },
  nano: { grupos: {} },
  configuracoes: { global: {}, grupos: {} },
  compras: { grupos: {} },
  ranking: { global: {}, grupos: {} },
  pagamentos: { grupos: {} },
  comprovativos: { grupos: {} },
  token: { dados: {} },
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

function defaultGroupConfig() {
  return {
    boasvindas: true,
    boasvindasTexto: null,
    saidas: true,
    saidaTexto: null,
    autoresposta: false,
    modoLivre: false,
    liberados: {},   // { nomeComando: 'membro' | 'cliente' | 'admin' }
    protecoes: {},   // preenchido pelas protecções (Parte 3)
    maxAvisos: 3,
    autorespostaTexto: null,
    dectetor: false,
    mutados: [],
    estiloMenu: 1,
    comprasAtivas: true,
    inatividadeDias: 30,
    agenda: [],
    telefones: [],
    horario: { abrir: null, fechar: null, ultimoAbrir: null, ultimoFechar: null },
  };
}

function normalize(name, data) {
  if (!isObj(data)) throw new Error('raiz inválida');
  const schema = SCHEMAS[name];
  for (const k of Object.keys(schema)) {
    if (data[k] === undefined) data[k] = clone(schema[k]);
    else if (!isObj(data[k])) throw new Error(`campo "${k}" inválido`);
  }
  return data;
}

class Database {
  constructor(dir, opts = {}) {
    this.dir = path.resolve(dir);
    this.backupDir = path.join(this.dir, 'backups');
    this.debounceMs = opts.debounceMs ?? 500;
    this.backupIntervalMin = opts.backupIntervaloMin ?? 60;
    this.keep = opts.backupsManter ?? 10;
    this.data = {};
    this.dirty = new Set();
    this.timer = null;
    this.backupTimer = null;
  }

  file(name) { return path.join(this.dir, name + '.json'); }

  init() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    for (const name of Object.keys(SCHEMAS)) this.data[name] = this._load(name);
    this.backup('arranque');
    if (this.backupIntervalMin > 0) {
      this.backupTimer = setInterval(() => {
        try { this.backup('periodico'); } catch (e) { log.error('Falha no backup periódico:', e); }
      }, this.backupIntervalMin * 60000);
      this.backupTimer.unref?.();
    }
    return this;
  }

  _tryRead(name, file) {
    return normalize(name, JSON.parse(fs.readFileSync(file, 'utf8')));
  }

  _backupFiles(name) {
    try {
      return fs.readdirSync(this.backupDir)
        .filter((d) => fs.statSync(path.join(this.backupDir, d)).isDirectory())
        .sort().reverse()
        .map((d) => path.join(this.backupDir, d, name + '.json'))
        .filter((f) => fs.existsSync(f));
    } catch { return []; }
  }

  _load(name) {
    const file = this.file(name);
    if (fs.existsSync(file)) {
      try { return this._tryRead(name, file); } catch (e) {
        log.error(`Base de dados "${name}" corrompida (${e.message}). A tentar recuperar de backup...`);
        try { fs.renameSync(file, `${file}.corrupto.${Date.now()}`); } catch { /* ignora */ }
        for (const bf of this._backupFiles(name)) {
          try {
            const data = this._tryRead(name, bf);
            this._writeAtomic(name, data);
            log.warn(`"${name}" recuperada de ${bf}`);
            return data;
          } catch { /* tenta o seguinte */ }
        }
        log.error(`Sem backup válido para "${name}". Foi criada uma base vazia.`);
      }
    }
    const data = clone(SCHEMAS[name]);
    this._writeAtomic(name, data);
    return data;
  }

  // Escrita segura: ficheiro temporário + fsync + rename (nunca deixa ficheiro a meio).
  _writeAtomic(name, data) {
    const file = this.file(name);
    const tmp = file + '.tmp';
    const fd = fs.openSync(tmp, 'w', name === 'token' ? 0o600 : 0o666);
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
  }

  get(name) {
    if (!this.data[name]) throw new Error(`Base de dados desconhecida: ${name}`);
    return this.data[name];
  }

  save(name) {
    if (!this.data[name]) throw new Error(`Base de dados desconhecida: ${name}`);
    this.dirty.add(name);
    if (!this.timer) {
      this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.debounceMs);
      this.timer.unref?.();
    }
  }

  flush() {
    for (const name of [...this.dirty]) {
      try {
        this._writeAtomic(name, this.data[name]);
        this.dirty.delete(name);
      } catch (e) {
        log.error(`Falha ao gravar "${name}":`, e); // continua marcada como suja
      }
    }
  }

  backup(motivo = 'manual') {
    this.flush();
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '');
    const dest = path.join(this.backupDir, stamp);
    fs.mkdirSync(dest, { recursive: true });
    for (const name of Object.keys(SCHEMAS)) {
      const f = this.file(name);
      if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dest, name + '.json'));
    }
    const dirs = fs.readdirSync(this.backupDir)
      .filter((d) => fs.statSync(path.join(this.backupDir, d)).isDirectory()).sort();
    while (dirs.length > this.keep) fs.rmSync(path.join(this.backupDir, dirs.shift()), { recursive: true, force: true });
    log.debug(`Backup (${motivo}) em ${dest}`);
    return dest;
  }

  /** Devolve data[name][key][id], criando-o com factory() se não existir. Dados sempre separados por ID. */
  section(name, key, id, factory) {
    const bucket = this.get(name)[key];
    if (!bucket) throw new Error(`Secção desconhecida: ${name}.${key}`);
    if (!bucket[id]) { bucket[id] = factory(); this.save(name); }
    return bucket[id];
  }

  groupOf(name, gid, factory) { return this.section(name, 'grupos', gid, factory); }

  /** Registo do grupo em grupos.json. */
  groupRecord(gid, extra = {}) {
    return this.groupOf('grupos', gid, () => ({
      id: gid, nome: null, primeiraVez: Date.now(), sessao: null, bloqueado: false, ...extra,
    }));
  }

  /** Configuração do grupo (com valores por defeito preenchidos). */
  groupConfig(gid) {
    const cfg = this.section('configuracoes', 'grupos', gid, defaultGroupConfig);
    const def = defaultGroupConfig();
    let changed = false;
    for (const k of Object.keys(def)) if (cfg[k] === undefined) { cfg[k] = def[k]; changed = true; }
    if (changed) this.save('configuracoes');
    return cfg;
  }

  close() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.backupTimer) { clearInterval(this.backupTimer); this.backupTimer = null; }
    this.flush();
    try { this.backup('encerramento'); } catch (e) { log.error('Backup final falhou:', e); }
  }
}

module.exports = { Database, SCHEMAS, defaultGroupConfig };
