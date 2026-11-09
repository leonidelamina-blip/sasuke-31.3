'use strict';
const log = require('../utils/logger');

function localParts(ms, tz = 'Africa/Maputo') {
  let p;
  try {
    p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).reduce((o, x) => { o[x.type] = x.value; return o; }, {});
  } catch {
    const d = new Date(ms);
    p = { year: d.getUTCFullYear(), month: String(d.getUTCMonth() + 1).padStart(2, '0'), day: String(d.getUTCDate()).padStart(2, '0'), hour: String(d.getUTCHours()), minute: String(d.getUTCMinutes()) };
  }
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const WINDOW_MIN = 10; // só executa se ainda estiver dentro de 10 min do horário

/** Devolve as acções devidas agora: [{gid, acao:'abrir'|'fechar'}] e marca-as como executadas. */
function due(db, rental, tz, now = Date.now()) {
  const { date, minutes } = localParts(now, tz);
  const out = [];
  for (const [gid, cfg] of Object.entries(db.get('configuracoes').grupos)) {
    const h = cfg.horario;
    if (!h || !rental.isActive(gid, now)) continue;
    for (const acao of ['abrir', 'fechar']) {
      const alvo = h[acao];
      const key = acao === 'abrir' ? 'ultimoAbrir' : 'ultimoFechar';
      if (!alvo || h[key] === date) continue;
      const diff = minutes - toMin(alvo);
      if (diff >= 0 && diff <= WINDOW_MIN) { h[key] = date; out.push({ gid, acao }); }
    }
  }
  if (out.length) db.save('configuracoes');
  return out;
}

/** Mensagens agendadas (.agendar): devolve as devidas agora e marca/remove conforme repetição. */
function dueAgenda(db, rental, tz, now = Date.now()) {
  const { date, minutes } = localParts(now, tz);
  const out = [];
  for (const [gid, cfg] of Object.entries(db.get('configuracoes').grupos)) {
    if (!Array.isArray(cfg.agenda) || !cfg.agenda.length || !rental.isActive(gid, now)) continue;
    for (const it of [...cfg.agenda]) {
      if (it.ultimo === date) continue;
      const diff = minutes - toMin(it.hhmm);
      if (diff < 0 || diff > WINDOW_MIN) continue;
      it.ultimo = date;
      out.push({ gid, texto: it.texto, id: it.id });
      if (!it.repetir) cfg.agenda = cfg.agenda.filter((x) => x.id !== it.id);
    }
  }
  if (out.length) db.save('configuracoes');
  return out;
}

/** Mensagens agendadas (.agendar): devolve as devidas agora e marca-as (as de "uma vez" são removidas). */
function dueAgenda(db, rental, tz, now = Date.now()) {
  const { date, minutes } = localParts(now, tz);
  const out = [];
  for (const [gid, cfg] of Object.entries(db.get('configuracoes').grupos)) {
    if (!Array.isArray(cfg.agenda) || !cfg.agenda.length || !rental.isActive(gid, now)) continue;
    for (const it of [...cfg.agenda]) {
      const diff = minutes - toMin(it.hhmm);
      if (it.ultimo !== date && diff >= 0 && diff <= WINDOW_MIN) {
        it.ultimo = date;
        out.push({ gid, texto: it.texto, id: it.id });
        if (!it.repetir) cfg.agenda = cfg.agenda.filter((x) => x.id !== it.id);
      }
    }
  }
  if (out.length) db.save('configuracoes');
  return out;
}

/** Mensagens agendadas (.agendar) devidas agora. Marca-as como enviadas; as de "uma vez" são removidas. */
function dueAgenda(db, rental, tz, now = Date.now()) {
  const { date, minutes } = localParts(now, tz);
  const out = [];
  for (const [gid, cfg] of Object.entries(db.get('configuracoes').grupos)) {
    if (!Array.isArray(cfg.agenda) || !cfg.agenda.length || !rental.isActive(gid, now)) continue;
    for (const it of [...cfg.agenda]) {
      if (it.ultimo === date) continue;
      const diff = minutes - toMin(it.hhmm);
      if (diff < 0 || diff > WINDOW_MIN) continue;
      it.ultimo = date;
      out.push({ gid, texto: it.texto });
      if (!it.repetir) cfg.agenda.splice(cfg.agenda.indexOf(it), 1);
    }
  }
  if (out.length) db.save('configuracoes');
  return out;
}

function start({ db, rental, config, sessions }) {
  const run = async () => {
    for (const { gid, acao } of due(db, rental, config.fusoHorario)) {
      const rec = db.get('grupos').grupos[gid];
      const s = (rec?.sessao && sessions.get(rec.sessao)) || sessions.principal();
      if (!s?.sock) continue;
      try {
        await s.scheduler.run(gid, (sock) => sock.groupSettingUpdate(gid, acao === 'abrir' ? 'not_announcement' : 'announcement'));
        s.groups.invalidate(gid);
        await s.scheduler.send(gid, { text: acao === 'abrir' ? '🔓 Grupo aberto (horário automático).' : '🔒 Grupo fechado (horário automático).' });
      } catch (e) {
        log.warn(`Horário automático falhou em ${gid}: ${e.message}`);
      }
    }
    for (const { gid, texto } of dueAgenda(db, rental, config.fusoHorario)) {
      const rec = db.get('grupos').grupos[gid];
      const s = (rec?.sessao && sessions.get(rec.sessao)) || sessions.principal();
      if (!s?.sock) continue;
      try { await s.scheduler.send(gid, { text: `⏰ ${texto}` }); } catch (e) { log.warn(`Mensagem agendada falhou em ${gid}: ${e.message}`); }
    }
  };
  const agenda = async () => {
    for (const { gid, texto } of dueAgenda(db, rental, config.fusoHorario)) {
      const rec = db.get('grupos').grupos[gid];
      const s = (rec?.sessao && sessions.get(rec.sessao)) || sessions.principal();
      if (!s?.sock) continue;
      try { await s.scheduler.send(gid, { text: texto }); } catch (e) { log.warn(`Mensagem agendada falhou em ${gid}: ${e.message}`); }
    }
  };
  const t = setInterval(() => { agenda().catch((e) => log.error('Agenda:', e)); run().catch((e) => log.error('Horário automático:', e)); }, 30000);
  t.unref?.();
  return () => clearInterval(t);
}

module.exports = { localParts, due, dueAgenda, start, toMin };
