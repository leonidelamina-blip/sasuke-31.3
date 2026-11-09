'use strict';
const { ativo, isento } = require('../services/protecao');
const { norm } = require('../utils/format');
const comp = require('../services/sms');

// Comprovativos copiados/encaminhados são facilmente falsificáveis: só valem após validação de um administrador.
const SUSPEITO = /(confirmado|transferiste|transferencia efectuada|transferencia efetuada|id da transac|id da transacao|transaction id|recebeste|pagamento efectuado|pagamento efetuado)/;
const MONTANTE = /\b\d[\d.,]*\s?(mt|mzn|meticais?)\b/;
const cooldown = new Map();

module.exports = {
  name: 'antiburlador',
  async onMessage(ctx) {
    if (!ctx.isGroup || isento(ctx) || !ctx.text || !ativo(ctx.db, ctx.jid, 'antiburlador')) return false;
    if (ativo(ctx.db, ctx.jid, 'autocomprovativo') && comp.parse(ctx.text)) return false; // tratado pelo comprovativo automático
    const t = norm(ctx.text);
    if (!(SUSPEITO.test(t) && MONTANTE.test(t))) return false;
    const k = `${ctx.jid}|${ctx.number}`;
    if (Date.now() - (cooldown.get(k) || 0) < 60000) return false;
    cooldown.set(k, Date.now());
    ctx.db.get('advertencias'); // garante a base
    require('../services/protecao').warnings(ctx.db).ocorrencia(ctx.jid, ctx.number, 'mensagem com aspecto de comprovativo', 'antiburlador');
    await ctx.send({
      text: `🛡️ @${ctx.number}, mensagens ou capturas de ecrã de comprovativo NÃO são prova de pagamento.\n⚠️ Administradores: confirmem sempre na vossa própria app M-Pesa / e-Mola antes de entregar qualquer produto.`,
      mentions: [ctx.sender],
    }, { quoted: null }).catch(() => {});
    return false;
  },
};
