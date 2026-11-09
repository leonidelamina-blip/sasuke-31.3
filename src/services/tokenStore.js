'use strict';
const crypto = require('crypto');

// Token do dono, guardado em database/token.json (ficheiro com permissões 600).
const dados = (db) => db.get('token').dados;
const atual = (db) => dados(db).token || null;
const gerar = () => 'sk_' + crypto.randomBytes(24).toString('hex');
const valido = (t) => /^[A-Za-z0-9._-]{16,128}$/.test(String(t || ''));

/** Define um novo token. O anterior continua válido 24 h (para migrar sem cortar acessos). */
function definir(db, token, por) {
  const d = dados(db);
  if (d.token) { d.anterior = d.token; d.anteriorAte = Date.now() + 24 * 3600 * 1000; }
  d.token = token; d.criadoEm = Date.now(); d.por = por;
  db.save('token');
  return d;
}

function igual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verificar(db, t) {
  const d = dados(db);
  if (!t) return false;
  if (d.token && igual(t, d.token)) return true;
  return !!(d.anterior && Date.now() < d.anteriorAte && igual(t, d.anterior));
}

module.exports = { atual, gerar, valido, definir, verificar, dados };
