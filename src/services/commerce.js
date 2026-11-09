'use strict';

const CAMPOS = ['tabela', 'pagamento', 'megas', 'contas', 'carteira', 'compra', 'loja'];
const VAZIO = 'Este grupo ainda não configurou esta informação. Um administrador pode utilizar o comando correspondente.';

/** Dados comerciais de UM grupo (chave = ID do grupo). Nunca partilhados entre grupos. */
function dados(db, gid) {
  const d = db.groupOf('pagamentos', gid, () => ({ mpesa: [], emola: [] }));
  for (const c of CAMPOS) if (d[c] === undefined) d[c] = null;
  if (!Array.isArray(d.mpesa)) d.mpesa = [];
  if (!Array.isArray(d.emola)) d.emola = [];
  if (!d.saldos || typeof d.saldos !== 'object') d.saldos = {};
  return d;
}

function setCampo(db, gid, campo, texto, por) {
  const d = dados(db, gid);
  d[campo] = texto ? { texto, por, em: Date.now() } : null;
  db.save('pagamentos');
}
const getCampo = (db, gid, campo) => dados(db, gid)[campo]?.texto || null;

function compras(db, gid) {
  return db.groupOf('compras', gid, () => ({ seq: 0, registos: [] }));
}

module.exports = { CAMPOS, VAZIO, dados, setCampo, getCampo, compras };
