'use strict';
const { fetchJson, indisponivel } = require('../utils/http');
const { userError, quotedText, tag, tsMs } = require('../utils/format');
const { jidToNumber, formatDate, formatUptime } = require('../utils/helpers');
const { localParts } = require('../services/groupSchedule');

const CAT = 'PESQUISA & FERRAMENTAS';

// ---------- calculadora segura (sem eval) ----------
function calcular(expr) {
  const s = String(expr).replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!s || s.length > 100) throw userError('Expressão vazia ou demasiado longa.');
  if (!/^[0-9+\-*/%^().]+$/.test(s)) throw userError('Só são permitidos números e + - * / % ^ ( ).');
  const tokens = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw userError('Número inválido.');
      tokens.push(n); i = j; continue;
    }
    const prev = tokens[tokens.length - 1];
    const unario = c === '-' && (prev === undefined || (typeof prev === 'string' && prev !== ')'));
    tokens.push(unario ? 'neg' : c); i++;
  }
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, neg: 3, '^': 4 };
  const dir = { '^': true, neg: true };
  const out = []; const st = [];
  for (const t of tokens) {
    if (typeof t === 'number') out.push(t);
    else if (t === '(') st.push(t);
    else if (t === ')') {
      while (st.length && st[st.length - 1] !== '(') out.push(st.pop());
      if (!st.length) throw userError('Parênteses inválidos.');
      st.pop();
    } else {
      while (st.length) {
        const top = st[st.length - 1];
        if (top === '(') break;
        if (prec[top] > prec[t] || (prec[top] === prec[t] && !dir[t])) out.push(st.pop()); else break;
      }
      st.push(t);
    }
  }
  while (st.length) { const x = st.pop(); if (x === '(') throw userError('Parênteses inválidos.'); out.push(x); }
  const v = [];
  for (const t of out) {
    if (typeof t === 'number') { v.push(t); continue; }
    if (t === 'neg') { if (!v.length) throw userError('Expressão inválida.'); v.push(-v.pop()); continue; }
    if (v.length < 2) throw userError('Expressão inválida.');
    const b = v.pop(); const a = v.pop();
    v.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : t === '/' ? a / b : t === '%' ? a % b : a ** b);
  }
  if (v.length !== 1 || !Number.isFinite(v[0])) throw userError('Não consegui calcular (divisão por zero ou expressão inválida).');
  return Math.round(v[0] * 1e10) / 1e10;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function calendario(tz) {
  const { date } = localParts(Date.now(), tz);
  const [y, m, d] = date.split('-').map(Number);
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const inicio = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // semana começa à segunda
  const linhas = ['Se Te Qu Qu Se Sá Do'];
  let l = '   '.repeat(inicio);
  for (let k = 1; k <= dias; k++) {
    l += (k === d ? `[${String(k).padStart(2, ' ').trim()}]`.padEnd(3, ' ') : String(k).padStart(2, ' ') + ' ');
    if ((inicio + k) % 7 === 0) { linhas.push(l.trimEnd()); l = ''; }
  }
  if (l.trim()) linhas.push(l.trimEnd());
  return `📅 ${MESES[m - 1]} ${y}\n\`\`\`\n${linhas.join('\n')}\n\`\`\`\nHoje: ${d}`;
}

const alvoJid = (ctx) => ctx.mentioned[0] || ctx.quotedSender || ctx.sender;

module.exports = [
  {
    name: 'ola', desc: 'Cumprimento do bot', category: 'AJUDA & INFORMAÇÕES', reaction: '👁️',
    async run(ctx) { await ctx.reply(`👁️ Olá, ${ctx.pushName || 'viajante'}! Eu sou o ${ctx.config.nome}.\nUsa ${ctx.config.prefixo}menu para ver os comandos.`); },
  },
  {
    name: 'cep', desc: 'Consulta um CEP (Brasil) pelo ViaCEP', category: CAT, reaction: '📮',
    async run(ctx) {
      const cep = (ctx.args[0] || '').replace(/\D/g, '');
      if (cep.length !== 8) throw userError('Uso: .cep 01001000 (8 dígitos)');
      let j;
      try { j = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`); } catch { throw indisponivel('ViaCEP'); }
      if (j.erro) throw userError('CEP não encontrado.');
      await ctx.reply(`📮 CEP ${j.cep}\n🛣️ ${j.logradouro || '-'}\n🏘️ ${j.bairro || '-'}\n🏙️ ${j.localidade}/${j.uf}`);
    },
  },
  {
    name: 'extrair', desc: 'Extrai links, e-mails e números de um texto (ou da mensagem respondida)', category: CAT, reaction: '🧲',
    async run(ctx) {
      const t = ctx.argText || quotedText(ctx);
      if (!t) throw userError('Cola um texto depois do comando ou responde a uma mensagem.');
      const uniq = (a) => [...new Set(a)];
      const links = uniq(t.match(/https?:\/\/\S+|www\.\S+/gi) || []);
      const emails = uniq(t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []);
      const nums = uniq(t.match(/\+?\d[\d\s-]{6,}\d/g) || []).map((x) => x.trim());
      const l = [];
      if (links.length) l.push('🔗 Links:\n' + links.slice(0, 15).join('\n'));
      if (emails.length) l.push('✉️ E-mails:\n' + emails.slice(0, 15).join('\n'));
      if (nums.length) l.push('🔢 Números:\n' + nums.slice(0, 15).join('\n'));
      await ctx.reply(l.length ? l.join('\n\n') : '🧲 Não encontrei links, e-mails nem números.');
    },
  },
  {
    name: 'g-search', desc: 'Pesquisa rápida (DuckDuckGo) com atalho para a pesquisa completa', category: CAT, reaction: '🔎',
    async run(ctx) {
      const q = ctx.argText.slice(0, 200);
      if (!q) throw userError('Uso: .g-search o que queres pesquisar');
      let j = null;
      try { j = await fetchJson(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`); } catch { throw indisponivel('DuckDuckGo'); }
      const rel = (j.RelatedTopics || []).filter((x) => x.Text && x.FirstURL).slice(0, 3);
      const l = [`🔎 ${q}`];
      if (j.AbstractText) l.push('', j.AbstractText.slice(0, 500), j.AbstractURL || '');
      for (const r of rel) l.push('', '• ' + r.Text.slice(0, 160), r.FirstURL);
      if (!j.AbstractText && !rel.length) l.push('', 'Sem resumo directo para esta pesquisa.');
      l.push('', `🌐 Pesquisa completa: https://www.google.com/search?q=${encodeURIComponent(q)}`);
      await ctx.reply(l.join('\n'));
    },
  },
  {
    name: 'gerar-link', desc: 'Gera um link wa.me (número e texto opcional)', category: CAT, reaction: '🔗',
    async run(ctx) {
      let num = (ctx.args[0] || '').replace(/\D/g, '');
      let texto = ctx.args.slice(1).join(' ');
      if (!/^\d{9,15}$/.test(num)) { texto = ctx.argText; num = ctx.number; }
      if (/^8[2-7]\d{7}$/.test(num)) num = '258' + num;
      await ctx.reply(`🔗 https://wa.me/${num}${texto ? '?text=' + encodeURIComponent(texto) : ''}`);
    },
  },
  {
    name: 'get-lid', desc: 'Mostra o ID (JID/LID) teu ou de quem marcares', category: CAT, reaction: '🆔',
    async run(ctx) {
      const j = alvoJid(ctx);
      await ctx.send({ text: `🆔 ${tag(j)}\nJID: ${j}\nNúmero/ID: ${jidToNumber(j)}${ctx.numbers.length > 1 && j === ctx.sender ? '\nOutros IDs: ' + ctx.numbers.join(', ') : ''}`, mentions: [j] });
    },
  },
  {
    name: 'info-msg', desc: 'Metadados da mensagem (ou da respondida); raw mostra o JSON', category: CAT, reaction: '📋',
    async run(ctx) {
      if (['raw', 'raw-message'].includes(ctx.invoked)) {
        const txt = JSON.stringify(ctx.msg, (k, v) => (v && v.type === 'Buffer') || v instanceof Uint8Array ? '[binário]' : v, 1);
        return ctx.reply('📋 ' + txt.slice(0, 3500));
      }
      const o = {
        id: ctx.msg.key.id, chat: ctx.jid, de: ctx.sender, nome: ctx.pushName, tipo: ctx.type,
        hora: tsMs(ctx.msg) ? formatDate(tsMs(ctx.msg), ctx.config.fusoHorario) : null,
        texto: ctx.text ? ctx.text.slice(0, 120) : null,
        respondida: ctx.quotedId ? { id: ctx.quotedId, de: ctx.quotedSender, tipo: Object.keys(ctx.quotedMessage || {})[0] || null } : null,
      };
      await ctx.reply('📋 ' + JSON.stringify(o, null, 1));
    },
  },
  {
    name: 'calcula', desc: 'Calculadora segura', category: 'OUTROS • MEMBROS', reaction: '🧮',
    async run(ctx) {
      if (!ctx.argText) throw userError('Uso: .calcula 2+2*3');
      await ctx.reply(`🧮 ${ctx.argText} = ${calcular(ctx.argText)}`);
    },
  },
  {
    name: 'uptime', desc: 'Há quanto tempo o bot está ligado', category: 'OUTROS • MEMBROS', reaction: '⏱️',
    async run(ctx) { await ctx.reply(`⏱️ Uptime: ${formatUptime(process.uptime())}`); },
  },
  {
    name: 'calendario', desc: 'Calendário do mês actual', category: 'AUTOMAÇÕES', reaction: '📅',
    async run(ctx) { await ctx.reply(calendario(ctx.config.fusoHorario)); },
  },
];
