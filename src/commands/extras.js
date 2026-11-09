'use strict';
const store = require('../services/messageStore');
const { fetchJson, fetchBuffer, indisponivel } = require('../utils/http');
const { resolveTargets } = require('../utils/targets');
const { userError, pick, tag, botNumbers } = require('../utils/format');
const { jidToNumber, formatDate, formatUptime } = require('../utils/helpers');
const { fonte1 } = require('../utils/format');

const DIV = 'DIVERSÃO';
const CRIMES = [
  'roubar o último pão de queijo', 'mandar áudio de 5 minutos sem avisar', 'responder "kkk" a tudo',
  'pôr o grupo em silêncio com um sticker gigante', 'dizer "já vou" e desaparecer 3 horas', 'chamar o Wi-Fi de "net"',
  'comer a pizza toda sozinho(a)', 'usar o telemóvel a 1% e pedir carregador', 'ter 47 conversas por ler',
];
const presos = new Map();
const chamados = new Map();

module.exports = [
  {
    name: 'meme', category: DIV, desc: 'Meme aleatório (inofensivo) de uma fonte pública', reaction: '🤣', groupOnly: true,
    async run(ctx) {
      let m = null;
      for (const sub of ['wholesomememes', 'memes']) {
        try {
          const j = await fetchJson(`https://meme-api.com/gimme/${sub}`);
          if (j && j.url && !j.nsfw && !j.spoiler) { m = j; break; }
        } catch { /* tenta a seguinte */ }
      }
      if (!m) throw indisponivel('memes');
      let buf;
      try { buf = await fetchBuffer(m.url, { timeout: 20000 }); } catch { throw indisponivel('imagens'); }
      await ctx.send({ image: buf, caption: `🤣 ${String(m.title || '').slice(0, 150)}` });
    },
  },
  {
    name: 'embaçar', category: DIV, desc: 'Brincadeira: "embaçou" e marca a pessoa (não bloqueia ninguém)', reaction: '😶', groupOnly: true,
    async run(ctx) {
      const alvo = resolveTargets(ctx, { includeArgs: false })[0];
      if (!alvo) throw userError('Marca ou responde a quem embaçou: .embaça @pessoa');
      await ctx.send({ text: `${tag(alvo)} embaçou 😶‍🌫️`, mentions: [alvo] }, { quoted: null });
    },
  },
  {
    name: 'cadeia', category: DIV, desc: 'Brincadeira: prende alguém na "cadeia" durante 1 minuto', reaction: '🚔', groupOnly: true,
    async run(ctx) {
      const alvo = resolveTargets(ctx, { includeArgs: false })[0];
      if (!alvo) throw userError('Marca quem queres prender: .cadeia @pessoa');
      if (botNumbers(ctx).includes(jidToNumber(alvo))) throw userError('Eu não vou preso 😎');
      const k = `${ctx.jid}|${jidToNumber(alvo)}`;
      if (presos.has(k)) throw userError('Essa pessoa já está presa!');
      const ms = ctx.config.diversao?.cadeiaMs ?? 60000;
      await ctx.send({ text: `🚔 ${tag(alvo)} foi preso(a) por ${Math.max(1, Math.round(ms / 60000))} minuto!\n⚖️ Crime: ${pick(CRIMES)}.`, mentions: [alvo] }, { quoted: null });
      const t = setTimeout(async () => {
        presos.delete(k);
        try { await ctx.scheduler.send(ctx.jid, { text: `🔓 ${tag(alvo)} foi solto(a). Bom comportamento!`, mentions: [alvo] }, { quoted: null }); } catch { /* grupo/sessão indisponível */ }
      }, ms);
      t.unref?.();
      presos.set(k, t);
    },
  },
  {
    name: 'app', category: 'OUTROS • MEMBROS', desc: 'Informação sobre o app/bot Sasuke', reaction: '📲',
    async run(ctx) {
      const a = ctx.config.app || {};
      await ctx.reply([
        `📲 ${a.nome || ctx.config.nome}`, `⚫ Versão ${ctx.config.versao} · ${ctx.config.arquitectura}`, '🤖 Bot de WhatsApp para grupos: vendas, comprovativos, protecções e diversão.',
        `📜 Comandos: ${ctx.registry.commands.list.length} (usa ${ctx.config.prefixo}menu)`, a.link ? `🔗 App: ${a.link}` : null, `📢 Canal: ${ctx.config.canal.link}`,
      ].filter(Boolean).join('\n'));
    },
  },
  {
    name: 'buttons', category: 'OUTROS • MEMBROS', desc: 'Painel de "botões" de exemplo do menu', reaction: '🔘',
    async run(ctx) {
      const p = ctx.config.prefixo;
      await ctx.reply([
        '🔘 PAINEL RÁPIDO', '',
        `[ 📜 ${p}menu ]   [ 🛒 ${p}compra ]`, `[ 💰 ${p}pagamento ]   [ 📶 ${p}megas ]`, `[ 🧾 ${p}comprovativo ]   [ 🎌 ${p}anime ]`, `[ 🏅 ${p}ranking ]   [ ⚡ ${p}ping ]`, '',
        'ℹ️ O WhatsApp normal não mostra botões clicáveis de bots: escreve o comando que queres.',
      ].join('\n'));
    },
  },
  {
    name: 'tempo', category: 'OUTROS • MEMBROS', desc: 'Uptime do bot e hora em Maputo', reaction: '🕒',
    async run(ctx) { await ctx.reply(`⏱️ Uptime: ${formatUptime(process.uptime())}\n🕒 Maputo: ${formatDate(Date.now(), ctx.config.fusoHorario)}`); },
  },
  {
    name: 'ti', category: 'OUTROS • MEMBROS', desc: 'Informação do bot: versão, dono, uptime', reaction: 'ℹ️',
    async run(ctx) {
      await ctx.reply([`ℹ️ ${ctx.config.nome}`, `⚫ Versão: ${ctx.config.versao} · ${ctx.config.arquitectura}`, `👑 Dono: ${ctx.config.dono.nome}`, `⏱️ Uptime: ${formatUptime(process.uptime())}`, `🟢 Estado: ${ctx.session.status}`].join('\n'));
    },
  },
  {
    name: 'ad', category: 'OUTROS • MEMBROS', desc: 'Chama os administradores do grupo (com cooldown)', reaction: '📣', groupOnly: true,
    async run(ctx) {
      const k = `${ctx.jid}|${ctx.number}`;
      if (Date.now() - (chamados.get(k) || 0) < 60000) throw userError('Já chamaste os admins há pouco. Espera 1 minuto.');
      const m = await ctx.refreshMeta();
      const admins = m.participants.filter((p) => p.admin).map((p) => p.id).slice(0, 10);
      if (!admins.length) throw userError('Não encontrei administradores.');
      chamados.set(k, Date.now());
      await ctx.send({ text: `📣 ${admins.map(tag).join(' ')}\n${tag(ctx.sender)} chama os administradores${ctx.argText ? ': ' + ctx.argText.slice(0, 300) : '.'}`, mentions: [...admins, ctx.sender] }, { quoted: null });
    },
  },
  {
    name: 'f-quote', category: 'OUTROS • MEMBROS', desc: 'Cartão de citação: da mensagem respondida (autor real) ou das tuas palavras', reaction: '🖋️',
    async run(ctx) {
      // Só cita mensagens REAIS (autor verdadeiro) ou o próprio texto de quem usa o comando. Nunca atribui frases a terceiros.
      let texto; let autor; let quando = null;
      const q = ctx.quotedMessage;
      if (q && ctx.quotedId) {
        texto = q.conversation || q.extendedTextMessage?.text || q.imageMessage?.caption || q.videoMessage?.caption || '';
        autor = ctx.quotedSender;
        const orig = store.find(ctx.jid, ctx.quotedId);
        if (orig?.messageTimestamp) quando = Number(orig.messageTimestamp) * 1000;
      } else { texto = ctx.argText; autor = ctx.sender; }
      if (!texto) throw userError('Responde a uma mensagem de texto com .f-quote, ou escreve: .f-quote o teu texto');
      if (!autor) throw userError('Não consegui identificar o autor da mensagem.');
      await ctx.send({
        text: `🩸 ❝ ${texto.slice(0, 600)} ❞\n\n${fonte1('—')} ${tag(autor)}${quando ? ' · ' + formatDate(quando, ctx.config.fusoHorario) : ''}`,
        mentions: [autor],
      }, { quoted: null });
    },
  },
];
