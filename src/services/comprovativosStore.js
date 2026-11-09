'use strict';
const fs = require('fs');
const path = require('path');

// Dados por grupo em database/comprovativos.json. Fotos em comprovativos/<grupo>/<id>.jpg
const grupo = (db, gid) => db.groupOf('comprovativos', gid, () => ({ seq: 0, registos: [] }));
const porReferencia = (db, gid, ref) => grupo(db, gid).registos.find((r) => r.referencia === String(ref).toUpperCase()) || null;
const porId = (db, gid, id) => grupo(db, gid).registos.find((r) => r.id === Number(id)) || null;
const pendentes = (db, gid) => grupo(db, gid).registos.filter((r) => r.estado === 'pendente');

function criar(db, gid, d) {
  const g = grupo(db, gid);
  const r = {
    id: ++g.seq, estado: 'pendente', em: Date.now(), operadora: 'outra', origem: 'manual', alertas: [],
    ...d, referencia: String(d.referencia).toUpperCase(),
  };
  g.registos.push(r);
  if (g.registos.length > 1000) g.registos.shift();
  db.save('comprovativos');
  return r;
}

function decidir(db, gid, id, estado, por, motivo) {
  const r = porId(db, gid, id);
  if (!r) throw Object.assign(new Error('Comprovativo não encontrado.'), { userMessage: 'Comprovativo não encontrado neste grupo.' });
  if (r.estado !== 'pendente') throw Object.assign(new Error('já tratado'), { userMessage: `O comprovativo #${r.id} já foi tratado (${r.estado}).` });
  r.estado = estado; r.decididoPor = por; r.decididoEm = Date.now();
  if (motivo) r.motivo = String(motivo).slice(0, 200);
  db.save('comprovativos');
  return r;
}

const pastaGrupo = (gid) => path.join(process.cwd(), 'comprovativos', String(gid).replace(/[^0-9a-zA-Z]/g, '_'));

function guardarFoto(gid, id, buf) {
  const dir = pastaGrupo(gid);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${id}.jpg`);
  fs.writeFileSync(f, buf);
  return path.relative(process.cwd(), f);
}

module.exports = { grupo, porReferencia, porId, pendentes, criar, decidir, guardarFoto };
