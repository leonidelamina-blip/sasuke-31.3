'use strict';
// Regista actividade (mensagens por grupo, nome do utilizador) para .ranking, .perfil e .otaku.
module.exports = {
  name: 'ranking',
  async onMessage(ctx) {
    if (!ctx.isGroup || ctx.type === 'protocolMessage' || ctx.type === 'reactionMessage' || ctx.type === 'senderKeyDistributionMessage') return false;
    const { db, number, jid, pushName } = ctx;
    const g = db.get('ranking').grupos;
    const grp = g[jid] || (g[jid] = {});
    const u = grp[number] || (grp[number] = { msgs: 0 });
    u.msgs++;
    u.ultima = Date.now();
    const glob = db.get('ranking').global;
    const r = glob[number] || (glob[number] = { pontos: 0, streak: 0, ultimoDaily: 0 });
    r.pontos++;
    if (pushName) r.nome = pushName;
    const us = db.get('usuarios').usuarios;
    const x = us[number] || (us[number] = { primeiraVez: Date.now() });
    if (pushName) x.nome = pushName;
    x.ultimaVez = Date.now();
    db.save('ranking'); db.save('usuarios');
    return false;
  },
};
