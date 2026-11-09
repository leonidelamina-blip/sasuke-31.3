'use strict';
const { userError, waitEvent } = require('../utils/format');
const { digits } = require('../utils/helpers');

const D = { category: 'CONEXÃO & PAREAMENTO', level: 'dono', nuncaLiberar: true, free: true };

const EXPLICACAO = [
  '📱 COMO EMPARELHAR O BOT',
  '',
  '1️⃣ No painel de hospedagem, PÁRA o bot.',
  '2️⃣ Apaga a pasta auth/ (a sessão antiga).',
  '3️⃣ Liga o bot: na consola aparece um código de 8 caracteres.',
  '4️⃣ No WhatsApp da conta do bot: Aparelhos conectados › Conectar com número de telefone › escreve o código.',
  '5️⃣ Quando a consola mostrar "Ligado ao WhatsApp", está pronto.',
  '',
  '⚠️ O código expira em cerca de 1 minuto. Se expirar, reinicia o bot para gerar outro.',
].join('\n');

const explica = (name, desc) => ({ ...D, name, desc, reaction: '📱', async run(ctx) { await ctx.reply(EXPLICACAO); } });

module.exports = [
  explica('qr', 'Explica como emparelhar o bot'),
  explica('pairing', 'Explica como emparelhar o bot'),
  explica('pair', 'Explica como emparelhar o bot'),
  explica('code', 'Explica como emparelhar o bot'),
  {
    ...D, name: 'conectar', desc: 'Sem argumentos explica o emparelhamento; com número liga uma sessão extra', reaction: '🔌',
    async run(ctx) {
      const phone = digits(ctx.args[0]);
      if (!ctx.args[0]) return ctx.reply(EXPLICACAO + '\n\nSessão EXTRA: .conectar 258xxxxxxxxx (número da outra conta)');
      if (!/^\d{10,15}$/.test(phone)) throw userError('Uso: .conectar <número internacional da conta do novo bot>');
      if (phone === ctx.config.dono.internacional) throw userError('Esse é o número do proprietário. Usa uma conta dedicada ao bot.');
      if (!ctx.sessions) throw userError('Gestor de sessões indisponível.');
      if (ctx.sessions.list().length >= ctx.config.sessoes.max) throw userError(`Limite de ${ctx.config.sessoes.max} sessões atingido.`);
      const id = 's' + phone;
      if (ctx.sessions.get(id)) throw userError('Essa sessão já existe. Vê com .sessoes');
      const s = await ctx.sessions.add(id, { phone });
      let code;
      try { code = await waitEvent(s, 'pairing', 45000); } catch {
        await ctx.sessions.remove(id, { apagarAuth: true });
        throw userError('Não consegui obter o código de emparelhamento. Tenta de novo.');
      }
      await ctx.reply(`🔌 Código para +${phone}:\n\n${code}\n\nNo WhatsApp dessa conta: Aparelhos conectados › Conectar com número de telefone. Aguardo a ligação (2 min)…`);
      try { await waitEvent(s, 'open', 120000); await ctx.reply(`✅ Sessão ${id} ligada.`); } catch {
        await ctx.reply(`⏳ A sessão ${id} ainda não ligou. Podes remover com .sessoes remover ${id}`);
      }
    },
  },
  {
    ...D, name: 'qrcode', desc: 'Explica o emparelhamento; ".qrcode novo" liga uma sessão extra por QR', reaction: '📷',
    async run(ctx) {
      if ((ctx.args[0] || '').toLowerCase() !== 'novo') return ctx.reply(EXPLICACAO + '\n\nSessão EXTRA por QR: .qrcode novo');
      let QR;
      try { QR = require('qrcode'); } catch { throw userError('Dependência "qrcode" em falta. Executa: npm install'); }
      if (!ctx.sessions) throw userError('Gestor de sessões indisponível.');
      if (ctx.sessions.list().length >= ctx.config.sessoes.max) throw userError(`Limite de ${ctx.config.sessoes.max} sessões atingido.`);
      const id = 'qr' + Date.now().toString(36);
      const s = await ctx.sessions.add(id, {}, { persist: false });
      let ligou = false;
      try {
        for (let i = 0; i < 4 && !ligou; i++) {
          const ev = await Promise.race([waitEvent(s, 'qr', 40000).then((q) => ({ q })), waitEvent(s, 'open', 40000).then(() => ({ open: true }))]);
          if (ev.open) { ligou = true; break; }
          const png = await QR.toBuffer(ev.q, { width: 420, margin: 2 });
          await ctx.send({ image: png, caption: `📷 QR da sessão ${id} (${i + 1}/4). Lê em: Aparelhos conectados › Conectar um aparelho.` });
          const r = await Promise.race([waitEvent(s, 'open', 55000).then(() => 'open'), waitEvent(s, 'qr', 55000).then(() => 'qr')]).catch(() => 'tempo');
          if (r === 'open') ligou = true;
        }
      } finally {
        if (ligou) ctx.sessions.persist(id, null);
        else await ctx.sessions.remove(id, { apagarAuth: true });
      }
      if (!ligou) throw userError('O QR expirou sem ligação. Tenta de novo com .qrcode novo');
      await ctx.reply(`✅ Sessão ${id} ligada e guardada.`);
    },
  },
  {
    ...D, name: 'desconectar', desc: 'Pára uma sessão extra (.desconectar <id>)', reaction: '🔌',
    async run(ctx) {
      const id = ctx.args[0];
      if (!id) throw userError('Uso: .desconectar <id da sessão> (vê com .sessoes)');
      if (id === ctx.config.sessaoPrincipal) throw userError('A sessão principal pára-se no painel de hospedagem (não por comando).');
      if (!ctx.sessions?.get(id)) throw userError('Sessão inexistente.');
      await ctx.sessions.stop(id);
      await ctx.reply(`🔌 Sessão ${id} desligada. Volta a ligar com .sessoes iniciar ${id}`);
    },
  },
  {
    ...D, name: 'status', desc: 'Estado do bot: online, versão e dono', reaction: '🟢',
    async run(ctx) {
      const s = ctx.session;
      await ctx.reply([
        `🟢 ${ctx.config.nome}`, `📡 Estado: ${s.status === 'online' ? 'online ✅' : s.status}`, `⚫ Versão: ${ctx.config.versao} · ${ctx.config.arquitectura}`,
        `👑 Dono: ${ctx.config.dono.nome}`, `🧩 Sessões: ${ctx.sessions ? ctx.sessions.list().length : 1}`,
      ].join('\n'));
    },
  },
  {
    ...D, name: 'sessoes', desc: 'Lista e gere as sessões ligadas', reaction: '🧩',
    async run(ctx) {
      if (!ctx.sessions) throw userError('Gestor de sessões indisponível.');
      const a = (ctx.args[0] || '').toLowerCase();
      const id = ctx.args[1];
      if (a === 'parar' || a === 'iniciar' || a === 'remover') {
        if (!id) throw userError(`Uso: .sessoes ${a} <id>`);
        if (id === ctx.config.sessaoPrincipal) throw userError('A sessão principal não pode ser gerida por aqui.');
        if (!ctx.sessions.get(id)) throw userError('Sessão inexistente.');
        if (a === 'parar') await ctx.sessions.stop(id);
        else if (a === 'iniciar') await ctx.sessions.resume(id);
        else await ctx.sessions.remove(id, { apagarAuth: true });
        return ctx.reply(`🧩 Sessão ${id}: ${a === 'parar' ? 'parada' : a === 'iniciar' ? 'iniciada' : 'removida (credenciais apagadas)'}.`);
      }
      const l = ctx.sessions.list();
      await ctx.reply(`🧩 Sessões (${l.length}):\n` + l.map((s) => `• ${s.id}${s.numero ? ' (+' + s.numero + ')' : ''} — ${s.estado} · fila ${s.fila.pendentes}`).join('\n') + '\n\nUso: .sessoes parar|iniciar|remover <id>');
    },
  },
];
