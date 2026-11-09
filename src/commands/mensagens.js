'use strict';
const store = require('../services/messageStore');
const { onOff, userError, quotedText, botNumbers, chunk, tag } = require('../utils/format');
const { jidToNumber, formatDate } = require('../utils/helpers');
const { render, BOAS_VINDAS, DESPEDIDA } = require('../services/welcome');

const C = 'Mensagens';
const G = { categoria: C, groupOnly: true, level: 'admin' };
const VARS = 'Variáveis: {nome} {numero} {grupo} {membros} {data} {hora} {foto}';

const toggle = (name, campo, reaction, descricao, rotulo) => ({
  ...G, name, reaction, descricao,
  async run(ctx) {
    const cfg = ctx.db.groupConfig(ctx.jid);
    const st = onOff(ctx.args[0]);
    if (st === null) return ctx.reply(`${rotulo}: ${cfg[campo] ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\nUso: .${name} on  ·  .${name} off`);
    cfg[campo] = st; ctx.db.save('configuracoes');
    await ctx.reply(`${rotulo}: ${st ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}`);
  },
});

const texto = (name, campo, reaction, descricao, padrao, rotulo) => ({
  ...G, name, reaction, descricao,
  async run(ctx) {
    const cfg = ctx.db.groupConfig(ctx.jid);
    if (!ctx.argText) return ctx.reply(`${rotulo} actual:\n\n${cfg[campo] || padrao}\n\n${VARS}\nUso: .${name} <mensagem>  ·  .${name} reset`);
    if (ctx.argText.toLowerCase() === 'reset') { cfg[campo] = null; ctx.db.save('configuracoes'); return ctx.reply(`${rotulo} reposta para o modelo oficial.`); }
    if (ctx.argText.length > 1500) throw userError('A mensagem pode ter no máximo 1500 caracteres.');
    cfg[campo] = ctx.argText; ctx.db.save('configuracoes');
    const prev = render(ctx.argText, { nome: ctx.pushName || ctx.number, numero: ctx.number, grupo: ctx.meta?.subject || '', membros: ctx.meta?.participants?.length || '', data: '', hora: '' });
    await ctx.reply(`✅ ${rotulo} guardada. Pré-visualização:\n\n${prev}`);
  },
});

const todos = async (ctx) => (await ctx.refreshMeta()).participants.map((p) => p.id);

module.exports = [
  toggle('boasvindas', 'boasvindas', '👋', 'Liga/desliga as boas-vindas', 'Boas-vindas'),
  texto('nanobemvindo', 'boasvindasTexto', '📝', 'Personaliza a mensagem de boas-vindas', BOAS_VINDAS, 'Mensagem de boas-vindas'),
  toggle('saidas', 'saidas', '🥀', 'Liga/desliga as despedidas', 'Despedidas'),
  texto('nanosaida', 'saidaTexto', '📝', 'Personaliza a mensagem de despedida', DESPEDIDA, 'Mensagem de despedida'),
  {
    ...G, name: 'autoresposta', reaction: '🤖', descricao: 'Resposta automática quando o bot é marcado',
    async run(ctx) {
      const cfg = ctx.db.groupConfig(ctx.jid);
      const st = onOff(ctx.args[0]);
      if (st === null && !ctx.argText) return ctx.reply(`Resposta automática: ${cfg.autoresposta ? 'ACTIVADA ✅' : 'DESACTIVADA ❌'}\nTexto: ${cfg.autorespostaTexto || '(padrão)'}\nUso: .autoresposta on/off  ·  .autoresposta <texto>  ·  .autoresposta reset`);
      if (st !== null) { cfg.autoresposta = st; ctx.db.save('configuracoes'); return ctx.reply(`Resposta automática: ${st ? 'ACTIVADA ✅' : 'DESACTIVADA ❌'}`); }
      if (ctx.argText.toLowerCase() === 'reset') cfg.autorespostaTexto = null;
      else { if (ctx.argText.length > 500) throw userError('Máximo de 500 caracteres.'); cfg.autorespostaTexto = ctx.argText; }
      ctx.db.save('configuracoes');
      await ctx.reply('✅ Texto da resposta automática actualizado.');
    },
  },
  {
    ...G, name: 'hidetag', reaction: '👻', descricao: 'Marca todos sem mostrar os @',
    async run(ctx) {
      const t = ctx.argText || quotedText(ctx);
      if (!t) throw userError('Uso: .hidetag <mensagem> (ou responde a uma mensagem de texto)');
      await ctx.send({ text: t, mentions: await todos(ctx) }, { quoted: null });
    },
  },
  {
    ...G, name: 'marcar', reaction: '📣', descricao: 'Marca todos os membros',
    async run(ctx) {
      const ids = await todos(ctx);
      const cab = ctx.argText ? `📣 ${ctx.argText}\n\n` : '📣 Marcação geral\n\n';
      const partes = chunk(ids, 30);
      for (let i = 0; i < partes.length; i++) {
        await ctx.send({ text: (i === 0 ? cab : '') + partes[i].map((j) => '▫️ ' + tag(j)).join('\n'), mentions: partes[i] }, { quoted: null });
      }
    },
  },
  {
    ...G, name: 'delete', reaction: '🗑️', descricao: 'Apaga a mensagem respondida',
    async run(ctx) {
      if (!ctx.quotedId) throw userError('Responde à mensagem que queres apagar.');
      const meu = botNumbers(ctx).includes(jidToNumber(ctx.quotedSender));
      if (!meu && !ctx.botIsAdmin) throw userError('Preciso de ser administrador para apagar mensagens de outras pessoas.');
      const key = { remoteJid: ctx.jid, id: ctx.quotedId, fromMe: meu, participant: ctx.quotedSender };
      await ctx.admin((s) => s.sendMessage(ctx.jid, { delete: key }));
    },
  },
  {
    ...G, name: 'limpar', reaction: '🧹', botAdmin: true, descricao: 'Apaga as últimas N mensagens vistas pelo bot (máx. 30)',
    async run(ctx) {
      const n = Math.min(30, Math.max(1, parseInt(ctx.args[0], 10) || 10));
      const alvo = store.last(ctx.jid, n + 1).filter((m) => m.key.id !== ctx.msg.key.id).slice(-n);
      if (!alvo.length) throw userError('Não tenho mensagens recentes guardadas para apagar.');
      let ok = 0;
      for (const m of alvo) {
        try { await ctx.admin((s) => s.sendMessage(ctx.jid, { delete: m.key })); ok++; } catch { /* continua */ }
      }
      store.remove(ctx.jid, alvo.map((m) => m.key.id));
      await ctx.reply(`🧹 ${ok}/${alvo.length} mensagens apagadas.\nℹ️ Só consigo apagar mensagens que recebi enquanto estava ligado.`);
    },
  },
  toggle('dectetor', 'dectetor', '🕵️', 'Deteta e anuncia alterações no grupo', 'Detector de eventos'),
  {
    categoria: C, groupOnly: true, level: 'admin', name: 'revelar', reaction: '🔎', descricao: 'Mostra os dados da mensagem respondida (sem violar privacidade)',
    async run(ctx) {
      if (!ctx.quotedId) throw userError('Responde à mensagem que queres inspeccionar.');
      const q = ctx.quotedMessage || {};
      const tipo = Object.keys(q).find((k) => k !== 'messageContextInfo') || 'desconhecido';
      const unica = !!(q.viewOnceMessage || q.viewOnceMessageV2 || q.viewOnceMessageV2Extension || q[tipo]?.viewOnce);
      if (unica) throw userError('Esta mensagem é de visualização única. Por respeito à privacidade não revelo o seu conteúdo.');
      const orig = store.find(ctx.jid, ctx.quotedId);
      const t = quotedText(ctx);
      const l = [
        '🔎 Mensagem respondida',
        `👤 Autor: ${ctx.quotedSender ? tag(ctx.quotedSender) : 'desconhecido'}`,
        `📦 Tipo: ${tipo}`,
        `🆔 ID: ${ctx.quotedId}`,
        orig?.messageTimestamp ? `🕒 Recebida: ${formatDate(Number(orig.messageTimestamp) * 1000, ctx.config.fusoHorario)}` : null,
        t ? `\n💬 ${t.slice(0, 700)}` : null,
      ].filter(Boolean);
      await ctx.send({ text: l.join('\n'), mentions: ctx.quotedSender ? [ctx.quotedSender] : [] });
    },
  },
];
