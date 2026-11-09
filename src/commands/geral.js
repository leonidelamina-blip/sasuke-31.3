'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const anime = require('../services/anime');
const { JUTSUS } = require('../services/animeData');
const { localParts } = require('../services/groupSchedule');
const textos = require('../utils/textos');
const { resolveTargets } = require('../utils/targets');
const { fetchBuffer } = require('../utils/http');
const { fonte1, userError, pick, randInt, hashInt, tag, botNumbers, tsMs, formatDuration } = require('../utils/format');
const { jidToNumber, formatUptime } = require('../utils/helpers');

const C = 'Geral';
const base = { categoria: C };
const free = { categoria: C, free: true };

// Menu exacto em src/data/menu.txt (a 1.ª parte vai na legenda da foto, o resto em texto)
let MENU_CACHE = null;
function lerMenu() {
  if (MENU_CACHE) return MENU_CACHE;
  let t;
  try { t = fs.readFileSync(path.join(__dirname, '..', 'data', 'menu.txt'), 'utf8').replace(/\r/g, '').trimEnd(); } catch { t = '🩸 SASUKE V31.2 — SHADOW GOD\nMenu indisponível (src/data/menu.txt em falta).'; }
  const corte = t.indexOf('🙋 COMANDOS DE MEMBROS');
  MENU_CACHE = corte > 0 ? { cabecalho: t.slice(0, corte).trimEnd(), corpo: t.slice(corte) } : { cabecalho: t, corpo: '' };
  return MENU_CACHE;
}
const HORA24 = 24 * 3600 * 1000;

const acao = (name, reaction, verbo, extras) => ({
  ...base, groupOnly: true, name, reaction, descricao: `${verbo} alguém`,
  async run(ctx) {
    const alvo = resolveTargets(ctx)[0];
    if (!alvo) throw userError(`Marca ou responde a quem queres ${verbo}.`);
    if (jidToNumber(alvo) === ctx.number) throw userError('Escolhe outra pessoa 😅');
    const t = pick(extras);
    await ctx.send({ text: `${reaction} ${tag(ctx.sender)} ${t.replace('{alvo}', tag(alvo))}`, mentions: [ctx.sender, alvo] });
  },
});

const tiposSharingan = [[35, 'Sharingan de 1 tomoe'], [60, 'Sharingan de 2 tomoes'], [80, 'Sharingan de 3 tomoes'], [93, 'Mangekyō Sharingan'], [99, 'Mangekyō Sharingan Eterno'], [101, 'Rinnegan desperto (lendário)']];

module.exports = [
  {
    ...free, name: 'menu', alias: ['help'], reaction: '📜', descricao: 'Menu oficial (texto exacto) com fotografia',
    async run(ctx) {
      const { cabecalho, corpo } = lerMenu();
      let foto = null;
      try { foto = await anime.fotoSasuke(); } catch (e) {
        await ctx.reply(`❌ ${e.userMessage || e.message}\nO menu vai ser enviado SEM imagem.`);
      }
      if (foto) {
        await ctx.send({ image: foto, caption: cabecalho });
        if (corpo) await ctx.send({ text: corpo }, { quoted: null });
      } else {
        await ctx.send({ text: corpo ? `${cabecalho}\n\n${corpo}` : cabecalho });
      }
    },
  },
  {
    ...free, name: 'dono', reaction: '👑', descricao: 'Dados do proprietário',
    async run(ctx) {
      const t = `👑 CRIADOR\n\n👤 ${ctx.config.dono.nome}\n📢 Canal: ${ctx.config.canal.link}`;
      const foto = anime.fotoDono();
      await ctx.send(foto ? { image: foto, caption: t } : { text: t });
    },
  },
  {
    ...free, name: 'sobre', reaction: 'ℹ️', descricao: 'Informações do bot',
    async run(ctx) {
      const foto = anime.fotoDono();
      const txt = [
        `🩸 ${ctx.config.nome}`, '',
        `⚫ Versão: ${ctx.config.versao}`, `🌀 Arquitectura: ${ctx.config.arquitectura}`,
        '🔥 Tecnologia: Node.js + Baileys', '👁️ Tema: Sasuke Uchiha / Itachi / Akatsuki', `⚡ Prefixo: ${ctx.config.prefixo}`,
        `📜 Comandos: ${ctx.registry.commands.list.length}`, '',
        `👑 Criador: ${ctx.config.dono.nome}`, `📢 Canal: ${ctx.config.canal.link}`,
      ].join('\n');
      await ctx.send(foto ? { image: foto, caption: txt } : { text: txt });
    },
  },
  {
    ...free, name: 'ping', reaction: '⚡', descricao: 'Latência real, uptime e estado do sistema',
    async run(ctx) {
      const recepcao = Math.max(0, Date.now() - tsMs(ctx.msg));
      let envioMs = 0;
      const sent = await ctx.scheduler.enqueue(ctx.jid, 'text', async (s) => {
        const t0 = Date.now();
        const r = await s.sendMessage(ctx.jid, { text: '⚡ A medir...' }, { quoted: ctx.msg });
        envioMs = Date.now() - t0;
        return r;
      }, { typing: false });
      const st = ctx.scheduler.stats();
      const txt = [
        '⚡ PING',
        `📥 Recepção: ${recepcao} ms`, `📤 Envio: ${envioMs} ms`,
        `⏱️ Uptime: ${formatUptime(process.uptime())}`,
        `🟢 Sessão: ${ctx.session.status}`,
        `🧠 RAM: ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB · livre ${(os.freemem() / 1048576).toFixed(0)} MB`,
        `📨 Fila: ${st.pendentes} pendentes · ${st.enviados} enviadas · ${st.falhas} falhas`,
        `🧩 Sessões: ${ctx.sessions ? ctx.sessions.list().length : 1}`,
        `📜 Comandos: ${ctx.registry.commands.list.length}`,
        `🟣 Node ${process.version}`,
      ].join('\n');
      try { await ctx.scheduler.enqueue(ctx.jid, 'text', (s) => s.sendMessage(ctx.jid, { text: txt, edit: sent.key }), { typing: false }); } catch { await ctx.reply(txt); }
    },
  },
  {
    ...base, name: 'perfil', reaction: '👤', descricao: 'O teu perfil (ou de quem marcares)',
    async run(ctx) {
      const alvo = resolveTargets(ctx)[0] || ctx.sender;
      const n = jidToNumber(alvo);
      const r = ctx.db.get('ranking').global[n];
      const u = ctx.db.get('usuarios').usuarios[n];
      const msgs = ctx.isGroup ? (ctx.db.get('ranking').grupos[ctx.jid]?.[n]?.msgs || 0) : 0;
      const eu = n === ctx.number;
      const part = (ctx.meta?.participants || []).find((p) => [p.id, p.lid, p.phoneNumber].filter(Boolean).some((x) => jidToNumber(x) === n));
      const nivel = eu ? ctx.level : (ctx.perms.isOwner([n]) ? 'dono' : part?.admin ? 'admin' : 'membro');
      const cap = [
        '👤 PERFIL', `📛 Nome: ${(eu ? ctx.pushName : null) || r?.nome || u?.nome || n}`, `📞 Número: +${n}`, `🔰 Nível: ${nivel}`,
        ctx.isGroup ? `💬 Mensagens no grupo: ${msgs}` : null, `⚫ Pontos: ${r?.pontos || 0}`, `🔥 Sequência diária: ${r?.streak || 0}`,
      ].filter(Boolean).join('\n');
      let foto = null;
      try { const url = await ctx.sock.profilePictureUrl(alvo, 'image'); if (url) foto = await fetchBuffer(url, { timeout: 12000 }); } catch { /* sem foto */ }
      await ctx.send(foto ? { image: foto, caption: cap, mentions: [alvo] } : { text: cap, mentions: [alvo] });
    },
  },
  {
    ...free, name: 'canal', reaction: '📢', descricao: 'Link do canal oficial',
    async run(ctx) {
      const c = ctx.config.canal;
      if (!c?.link) throw userError('O canal oficial ainda não foi configurado (config.json → canal.link).');
      await ctx.reply(`📢 ${c.nome || 'Canal oficial'}\n🔗 ${c.link}`);
    },
  },
  {
    ...base, name: 'dado', reaction: '🎲', descricao: 'Lança um dado (padrão 6 lados)',
    async run(ctx) {
      const n = ctx.args[0] ? parseInt(ctx.args[0], 10) : 6;
      if (!Number.isInteger(n) || n < 2 || n > 1000) throw userError('Uso: .dado [lados] (2 a 1000)');
      await ctx.reply(`🎲 Dado de ${n} lados: *${randInt(1, n)}*`);
    },
  },
  {
    ...base, name: 'moeda', reaction: '🪙', descricao: 'Cara ou coroa',
    async run(ctx) { await ctx.reply(`🪙 ${randInt(0, 1) ? 'CARA' : 'COROA'}`); },
  },
  {
    ...base, name: '8ball', reaction: '🎱', descricao: 'Bola mágica',
    async run(ctx) {
      if (!ctx.argText) throw userError('Faz uma pergunta: .8ball Vou ganhar hoje?');
      const R = ['Sim, sem dúvida.', 'Tudo aponta que sim.', 'Podes contar com isso.', 'Provavelmente sim.', 'Os sinais são bons.', 'Ainda é incerto, pergunta de novo.', 'Concentra-te e tenta outra vez.', 'Melhor não te dizer agora.', 'Não conte com isso.', 'Minha resposta é não.', 'As fontes dizem que não.', 'Muito duvidoso.'];
      await ctx.reply(`🎱 ${ctx.argText}\n\n${pick(R)}`);
    },
  },
  {
    ...base, groupOnly: true, name: 'ranking', reaction: '🏅', descricao: 'Membros mais activos do grupo',
    async run(ctx) {
      const top = Object.entries(ctx.db.get('ranking').grupos[ctx.jid] || {}).sort((a, b) => b[1].msgs - a[1].msgs).slice(0, 10);
      if (!top.length) return ctx.reply('🏅 Ainda não há actividade registada neste grupo.');
      const m = ['🥇', '🥈', '🥉'];
      await ctx.send({ text: '🏅 MAIS ACTIVOS\n\n' + top.map(([n, v], i) => `${m[i] || `${i + 1}.`} @${n} — ${v.msgs} msgs`).join('\n'), mentions: top.map(([n]) => n + '@s.whatsapp.net') });
    },
  },
  acao('beijar', '💋', 'beijar', ['deu um beijo em {alvo}', 'beijou {alvo} com carinho', 'roubou um beijo de {alvo}']),
  acao('abraçar', '🤗', 'abraçar', ['abraçou {alvo} bem apertado', 'deu um abraço caloroso em {alvo}', 'abraçou {alvo} com todo o chakra']),
  acao('socar', '👊', 'socar', ['deu um soco em {alvo}', 'acertou {alvo} com um golpe de taijutsu', 'socou {alvo} (de brincadeira!)']),
  {
    ...base, name: 'style-menu', reaction: '🎨', descricao: 'Estilo visual do menu e identidade',
    async run(ctx) {
      const a = ctx.args[0];
      if (a) {
        if (!ctx.isGroup) throw userError('O estilo do menu é definido por grupo. Usa este comando num grupo.');
        if (!ctx.isAdmin && !ctx.isOwner) throw userError('Só administradores podem alterar o estilo.');
        if (!['1', '2'].includes(a)) throw userError('Uso: .style-menu 1 (𝑺𝑨𝑺𝑼𝑲𝑬) ou .style-menu 2 (SASUKE)');
        ctx.db.groupConfig(ctx.jid).estiloMenu = Number(a); ctx.db.save('configuracoes');
        return ctx.reply(`🎨 Estilo do menu: Fonte ${a} (${a === '1' ? fonte1('SASUKE') : 'SASUKE'}).`);
      }
      const atual = ctx.isGroup ? ctx.db.groupConfig(ctx.jid).estiloMenu : 1;
      await ctx.reply([
        '🎨 ESTILO', `Fonte 1: ${fonte1('SASUKE')}`, 'Fonte 2: SASUKE', `Actual: Fonte ${atual}`, '',
        'Paleta: ⚫ #000000 · 🩸 #8B0000 · 🟣 #4B0082 · ⚪ #F8F8FF · ◾ #242424', 'Símbolos: 🩸 👁️ ⚫ 🔥 🌀 ⚡ 👑 🥀', '', 'Uso: .style-menu 1  ·  .style-menu 2',
      ].join('\n'));
    },
  },
  {
    ...base, name: 'jutsu', reaction: '⚡', descricao: 'Jutsu aleatório',
    async run(ctx) {
      const [nome, tipo, desc] = pick(JUTSUS);
      await ctx.reply(`⚡ ${fonte1(nome.toUpperCase())}\n🌀 Tipo: ${tipo}\n\n${desc}`);
    },
  },
  {
    ...base, name: 'sharingan', reaction: '👁️', descricao: 'Descobre o teu nível de Sharingan (diversão, muda por dia)',
    async run(ctx) {
      const dia = localParts(Date.now(), ctx.config.fusoHorario).date;
      const roll = hashInt(`${ctx.number}|${dia}`) % 100;
      const nivel = tiposSharingan.find(([lim]) => roll < lim)[1];
      await ctx.send({ text: `👁️ ${tag(ctx.sender)} despertou hoje:\n🩸 ${nivel}\n\n(apenas diversão — muda todos os dias)`, mentions: [ctx.sender] });
    },
  },
  {
    ...base, groupOnly: true, name: 'ship', reaction: '💘', descricao: 'Compatibilidade entre duas pessoas (diversão)',
    async run(ctx) {
      let ts = resolveTargets(ctx, { includeArgs: false });
      if (ts.length === 1) ts = [ctx.sender, ts[0]];
      if (ts.length < 2) throw userError('Marca duas pessoas: .ship @a @b (ou uma, para shipar contigo).');
      const [a, b] = ts; const p = hashInt([jidToNumber(a), jidToNumber(b)].sort().join('|')) % 101;
      const barra = '█'.repeat(Math.round(p / 10)) + '░'.repeat(10 - Math.round(p / 10));
      const com = p > 85 ? 'Destino traçado!' : p > 60 ? 'Há química.' : p > 35 ? 'Talvez com o tempo.' : 'Os caminhos divergem…';
      await ctx.send({ text: `💘 ${tag(a)} + ${tag(b)}\n${barra} ${p}%\n${com}\n\n(apenas diversão)`, mentions: [a, b] });
    },
  },
  {
    ...base, groupOnly: true, name: 'casal', reaction: '💑', descricao: 'Casal do dia (diversão)',
    async run(ctx) {
      const m = await ctx.refreshMeta();
      const bots = botNumbers(ctx);
      const ids = m.participants.map((p) => p.id).filter((j) => !bots.includes(jidToNumber(j)));
      if (ids.length < 2) throw userError('Preciso de pelo menos 2 membros.');
      const dia = localParts(Date.now(), ctx.config.fusoHorario).date;
      const i = hashInt(`${ctx.jid}|${dia}|a`) % ids.length;
      let k = hashInt(`${ctx.jid}|${dia}|b`) % ids.length;
      if (k === i) k = (k + 1) % ids.length;
      await ctx.send({ text: `💑 Casal do dia:\n${tag(ids[i])} ❤️ ${tag(ids[k])}\n\n(apenas diversão — muda todos os dias)`, mentions: [ids[i], ids[k]] });
    },
  },
  {
    ...base, name: 'daily', reaction: '🎁', descricao: 'Prémio diário de pontos',
    async run(ctx) {
      const g = ctx.db.get('ranking').global;
      const r = g[ctx.number] || (g[ctx.number] = { pontos: 0, streak: 0, ultimoDaily: 0 });
      const now = Date.now(); const dt = now - (r.ultimoDaily || 0);
      if (r.ultimoDaily && dt < HORA24) throw userError(`Já recebeste o prémio de hoje. Volta em ${formatDuration(HORA24 - dt)}.`);
      r.streak = r.ultimoDaily && dt < 2 * HORA24 ? r.streak + 1 : 1;
      const premio = 100 + 10 * Math.min(r.streak - 1, 9);
      r.pontos += premio; r.ultimoDaily = now;
      if (ctx.pushName) r.nome = ctx.pushName;
      ctx.db.save('ranking');
      await ctx.reply(`🎁 Prémio diário: +${premio} pontos\n🔥 Sequência: ${r.streak} dia(s)\n⚫ Total: ${r.pontos} pontos`);
    },
  },
];
