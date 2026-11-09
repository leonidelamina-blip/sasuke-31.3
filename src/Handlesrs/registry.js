'use strict';
const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const { LEVELS } = require('../services/permissions');
const { emojiValido } = require('../utils/safeReact');

const NAME_RE = /^[\p{L}\p{N}_-]+$/u;

function walk(dir) {
  dir = path.resolve(dir);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name.startsWith('.')) continue; // modelos e ficheiros ocultos/estranhos
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}

/** Carrega cada ficheiro isoladamente: se um falhar, regista o erro e continua. */
function loadModules(dir) {
  const mods = [];
  for (const file of walk(dir)) {
    let m;
    try { m = require(file); } catch (e) {
      log.error(`Ficheiro ignorado (erro ao carregar) ${path.relative(process.cwd(), file)}: ${e.message}`);
      continue;
    }
    for (const item of Array.isArray(m) ? m : [m]) mods.push({ item, file });
  }
  return mods;
}

/** Contrato: name, run obrigatórios. alias/desc/category têm valores por defeito. reaction é OPCIONAL (pode ser null ou não existir). */
function normalizar(c) {
  c.alias = Array.isArray(c.alias) ? c.alias : (Array.isArray(c.aliases) ? c.aliases : []);
  c.aliases = c.alias;
  c.desc = c.desc || c.descricao || '';
  c.descricao = c.desc;
  c.category = c.category || c.categoria || 'OUTROS';
  c.categoria = c.category;
  if (typeof c.reaction !== 'string' || !emojiValido(c.reaction)) c.reaction = null; // só 1 emoji válido ou null
  return c;
}

function validar(c, file) {
  const where = path.relative(process.cwd(), file);
  if (!c || typeof c !== 'object') throw new Error(`${where}: comando inválido`);
  if (typeof c.name !== 'string' || !NAME_RE.test(c.name) || c.name !== c.name.toLowerCase()) throw new Error(`${where}: "name" inválido`);
  if (typeof c.run !== 'function') throw new Error(`${where}: ".${c.name}" sem função run`);
  if (c.level !== undefined && !LEVELS[c.level]) throw new Error(`${where}: ".${c.name}" com level inválido`);
  c.alias = c.alias.filter((a) => typeof a === 'string' && NAME_RE.test(a));
  c.aliases = c.alias;
}

/** Aplica a tabela central de atalhos (src/data/aliases.js). */
function aplicarAliases(map, tabela) {
  for (const [canon, lista] of Object.entries(tabela)) {
    const cmd = map.get(canon);
    if (!cmd) { log.warn(`Tabela de atalhos: comando ".${canon}" não existe.`); continue; }
    for (const item of lista) {
      const nome = typeof item === 'string' ? item : item.nome;
      const args = typeof item === 'string' ? null : item.args;
      if (map.has(nome)) { log.warn(`Atalho ".${nome}" ignorado (já existe).`); continue; }
      map.set(nome, cmd);
      if (!cmd.alias.includes(nome)) cmd.alias.push(nome);
      if (args) cmd.aliasArgs = { ...(cmd.aliasArgs || {}), [nome]: args };
    }
  }
}

function loadCommands(dir, { tabela = null } = {}) {
  const map = new Map();
  const list = [];
  const autos = [];
  for (const { item: c, file } of loadModules(dir)) {
    try {
      normalizar(c);
      validar(c, file);
      if (map.has(c.name)) throw new Error(`Comando duplicado: ".${c.name}"`);
      const nomes = [];
      for (const a of c.alias) {
        if (map.has(a) || a === c.name) { log.warn(`Atalho ".${a}" de ".${c.name}" ignorado (já existe).`); continue; }
        nomes.push(a);
      }
      c.alias = nomes; c.aliases = nomes;
      for (const n of [c.name, ...nomes]) map.set(n, c);
      list.push(c);
      if (typeof c.handleAuto === 'function') autos.push({ name: `${c.name}:auto`, onMessage: c.handleAuto });
    } catch (e) {
      log.error(`Comando ignorado: ${e.message}`);
    }
  }
  if (tabela) aplicarAliases(map, tabela);
  return { map, list, autos };
}

function loadRegistry(root = process.cwd()) {
  let tabela = {};
  try { tabela = require(path.join(root, 'src', 'data', 'aliases.js')); } catch (e) { log.error(`Tabela de atalhos não carregada: ${e.message}`); }
  const commands = loadCommands(path.join(root, 'src', 'commands'), { tabela });

  const hooks = [];
  for (const { item, file } of loadModules(path.join(root, 'src', 'protections'))) {
    if (typeof item?.name !== 'string' || typeof item.onMessage !== 'function') {
      log.error(`Protecção ignorada ${path.relative(root, file)}: precisa de { name, onMessage }`);
      continue;
    }
    hooks.push(item);
  }
  hooks.push(...commands.autos); // handleAuto de comandos (ex.: comprovativo.js), corre antes dos comandos

  const events = [];
  for (const { item, file } of loadModules(path.join(root, 'src', 'handlers', 'events'))) {
    if (typeof item?.event !== 'string' || typeof item.run !== 'function') {
      log.error(`Evento ignorado ${path.relative(root, file)}: precisa de { event, run }`);
      continue;
    }
    events.push(item);
  }

  log.info(`Registo carregado: ${commands.list.length} comandos · ${commands.map.size} nomes (com atalhos) · ${hooks.length} automatismos · ${events.length} eventos`);
  return { commands, hooks, events };
}

module.exports = { loadRegistry, loadCommands };
