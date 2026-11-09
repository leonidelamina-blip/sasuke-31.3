'use strict';

const TOPO = [
  '╔═══ 🩸 𝑺𝑯𝑨𝑫𝑶𝑾 𝑮𝑶𝑫 🩸 ═══╗',
  '👁️ 𝑴𝑨𝑵𝑮𝑬𝑲𝒀𝑶 𝑺𝑯𝑨𝑹𝑰𝑵𝑮𝑨𝑵',
  '⚫ 𝑺𝑨𝑺𝑼𝑲𝑬 𝑼𝑪𝑯𝑰𝑯𝑨',
  '🩸 "𝑽𝒐𝒄𝒆𝒔 𝒔𝒂𝒐 𝒇𝒓𝒂𝒄𝒐𝒔... 𝒎𝒆 𝒅𝒂𝒐 𝒏𝒐𝒋𝒐."',
  '╚════════════════════════╝',
].join('\n');

const link = (c) => (c.canal && c.canal.link) || '';

// Grupo que nunca teve aluguer
function semAluguel(config) {
  return ['🩸 Este grupo não tem aluguer activo.', '', '👁️ Para activar o SASUKE SHADOW GOD entra no canal:', `📢 ${link(config)}`].join('\n');
}

function aluguelAtivo(dias) {
  return ['🩸 SASUKE V31.3 — SHADOW GOD', '', '👁️ ALUGUER ACTIVO!', '', `⚡ Duração: ${dias} dias.`, '', '👑 CORE 77 ACTIVADO.'].join('\n');
}

// Textos pedidos exactamente assim
const aluguelExpirado = (c) => `Aluguer expirado, entra no canal para renovar: ${link(c)}`;
const aluguelUmDia = (c) => `Falta 1 dia, renova no canal: ${link(c)}`;
const aluguelAnulado = (c) => `🩸 O aluguer deste grupo foi anulado. Entra no canal para renovar: ${link(c)}`;

const semPermissao = '🩸 Sem permissão para usar este comando.';
const soGrupos = '🩸 Este comando só pode ser usado em grupos.';
const botSemAdmin = '🩸 Preciso de ser administrador do grupo para executar este comando.';
const erroGenerico = '❌ Erro ao executar comando, tenta de novo.';

module.exports = { TOPO, semAluguel, aluguelAtivo, aluguelExpirado, aluguelUmDia, aluguelAnulado, semPermissao, soGrupos, botSemAdmin, erroGenerico };
