'use strict';
const { makeToggle, warnings } = require('../services/protecao');
const { resolveTargets } = require('../utils/targets');
const { userError } = require('../utils/format');
const { jidToNumber, formatDate } = require('../utils/helpers');

const t = (name, reaction, descricao, extra) => makeToggle({ name, reaction, descricao, extra });

module.exports = [
  t('antilink', '🛡️', 'Apaga links de grupos do WhatsApp'),
  t('antilinkhard', '🔗', 'Apaga qualquer link'),
  t('anticanal', '📢', 'Apaga links e reencaminhamentos de canais'),
  t('antifoto', '🖼️', 'Apaga fotos'),
  t('antivideo', '🎬', 'Apaga vídeos'),
  t('antiaudio', '🎙️', 'Apaga áudios'),
  t('antisticker', '🏷️', 'Apaga stickers'),
  t('antidoc', '📎', 'Apaga documentos'),
  t('antiviewonce', '👀', 'Apaga mensagens de visualização única'),
  t('antifake', '🚫', 'Remove números fora dos prefixos permitidos (por defeito +258)', async (ctx) => {
    const prefixos = ctx.args.slice(1).map((p) => p.replace(/\D/g, '')).filter((p) => /^\d{1,4}$/.test(p));
    return { prefixos: prefixos.length ? prefixos : ['258'] };
  }),
  t('antiflood', '🌊', 'Avisa quem envia mensagens depressa demais', async (ctx) => {
    const maxMsgs = parseInt(ctx.args[1], 10); const janelaSeg = parseInt(ctx.args[2], 10);
    const p = {};
    if (maxMsgs >= 3 && maxMsgs <= 30) p.maxMsgs = maxMsgs;
    if (janelaSeg >= 3 && janelaSeg <= 60) p.janelaSeg = janelaSeg;
    return p;
  }),
  t('antipalavrao', '🤐', 'Apaga mensagens com palavrões'),
  t('antidelete', '♻️', 'Repõe mensagens apagadas (só as que o bot recebeu)'),
  t('automover', '⚙️', 'Remove quem atinge o limite de avisos'),
  {
    categoria: 'Protecções', groupOnly: true, level: 'admin', nuncaLiberar: true, name: 'maxavisos', reaction: '⚠️',
    descricao: 'Define o limite de avisos e gere avisos de membros',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      const w = warnings(ctx.db);
      const a = (ctx.args[0] || '').toLowerCase();
      if (!a) return ctx.reply(`⚠️ Limite de avisos: ${cfg.maxAvisos}\nUso: .maxavisos 5  ·  .maxavisos ver @user  ·  .maxavisos reset @user`);
      if (/^\d+$/.test(a)) {
        const n = Number(a);
        if (n < 1 || n > 10) throw userError('O limite deve estar entre 1 e 10.');
        cfg.maxAvisos = n; ctx.db.save('configuracoes');
        return ctx.reply(`⚠️ Limite de avisos definido para ${n}.`);
      }
      if (a === 'ver' || a === 'reset') {
        const alvo = resolveTargets({ ...ctx, args: ctx.args.slice(1) })[0];
        if (!alvo) throw userError(`Uso: .maxavisos ${a} @user`);
        const n = jidToNumber(alvo);
        if (a === 'reset') { w.reset(ctx.jid, n); return ctx.send({ text: `♻️ Avisos de @${n} repostos.`, mentions: [alvo] }); }
        const u = w.get(ctx.jid, n);
        const h = u.historico.slice(-5).map((x) => `• ${formatDate(x.em, ctx.config.fusoHorario)} — ${x.motivo}`).join('\n');
        return ctx.send({ text: `⚠️ @${n}: ${u.count}/${cfg.maxAvisos} avisos${h ? '\n' + h : ''}`, mentions: [alvo] });
      }
      throw userError('Uso: .maxavisos 5  ·  .maxavisos ver @user  ·  .maxavisos reset @user');
    },
  },
];
