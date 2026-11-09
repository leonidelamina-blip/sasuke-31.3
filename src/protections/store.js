'use strict';
const store = require('../services/messageStore');
// Guarda mensagens recentes (memória) para .antidelete / .limpar / .revelar.
module.exports = {
  name: 'store',
  async onMessage(ctx) {
    if (ctx.isGroup && ctx.type !== 'protocolMessage' && ctx.type !== 'reactionMessage') store.add(ctx.jid, ctx.msg);
    return false;
  },
};
