'use strict';
// Lista oficial dos 120 comandos, na ordem da especificação.
const MENU = [
  ['Membros', '👥', 'A. MEMBROS', ['ban', 'kick', 'add', 'promover', 'rebaixar', 'mute', 'unmute', 'banlist', 'unban', 'admins', 'membros', 'online']],
  ['Administração', '🏠', 'B. ADMINISTRAÇÃO DE GRUPOS', ['abrir', 'fechar', 'abrirhorario', 'fecharhorario', 'nome', 'desc', 'link', 'novolink', 'infogp']],
  ['Mensagens', '💬', 'C. MENSAGENS', ['boasvindas', 'nanobemvindo', 'saidas', 'nanosaida', 'autoresposta', 'hidetag', 'marcar', 'delete', 'limpar', 'dectetor', 'revelar']],
  ['Nano', '🤖', 'D. SISTEMA NANO', ['nano', 'nanoadd', 'nanolist', 'nanodel', 'limparnano']],
  ['Protecções', '🛡️', 'E. PROTECÇÕES', ['antilink', 'antilinkhard', 'anticanal', 'antifoto', 'antivideo', 'antiaudio', 'antisticker', 'antidoc', 'antiviewonce', 'antifake', 'antiflood', 'antipalavrao', 'antidelete', 'automover', 'maxavisos']],
  ['Pagamentos', '💳', 'F. PAGAMENTOS E COMPRAS', ['compra', 'tabela', 'contas', 'carteira', 'pagamento', 'megas', 'loja', 'saldo', 'addmpesa', 'addemola', 'antiburlador']],
  ['Permissões', '🔓', 'G. PERMISSÕES SASUKE', ['liberartodos', 'liberar', 'clientes', 'modolivre', 'bloqueartodos', 'permissoes']],
  ['Proprietário', '👑', 'H. PROPRIETÁRIO', ['alugar', 'tirardias', 'anular', 'alugueis', 'conectar', 'qrcode', 'sessoes', 'bangp']],
  ['Anime', '🎌', 'I. ANIME', ['sasuke', 'naruto', 'itachi', 'waifu', 'anime', 'wallpaper', 'quote', 'amv', 'otaku', 'madara', 'kakashi', 'sakura', 'hinata', 'obito']],
  ['Geral', '⚙️', 'J. GERAL', ['menu', 'dono', 'sobre', 'ping', 'perfil', 'canal', 'dado', 'moeda', '8ball', 'ranking', 'beijar', 'abraçar', 'socar', 'style-menu', 'jutsu', 'sharingan', 'ship', 'casal', 'daily']],
  ['Aluguer', '🏠', 'K. ALUGUER POR GRUPO', ['settabela', 'setpagamento', 'setmegas', 'setcontas', 'setcarteira', 'setcompra', 'setloja', 'vertabela', 'limpartabela', 'verloja']],
];
const TODOS = MENU.flatMap((m) => m[3]);

module.exports = { MENU, TODOS };
