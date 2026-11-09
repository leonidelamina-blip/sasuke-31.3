'use strict';
/**
 * Tabela central de atalhos: comando principal -> nomes alternativos.
 * Um item pode ser { nome, args } quando o atalho já traz argumentos (ex.: antiestrangeiros-on = antifake on).
 * Os ficheiros de comandos também podem ter o seu próprio campo `alias`.
 */
module.exports = {
  // ajuda / informação
  menu: ['imenu', 'menubot', 'list', 'ajuda'],
  dono: ['criador'],
  sobre: ['info'],
  admins: ['adm'],
  status: ['bot'],
  // compras
  compra: [{ nome: 'compras', args: ['lista'] }],
  verificarsms: ['verificar', 'sms'],
  verificarrecibo: ['checkrecibo'],
  pagamento: ['m-pesa', 'mpesa', 'payment', 'pagamentos', 'pb', 'px'],
  'auto-comprovativo': ['autocomprovativo', 'venda-automatica', 'venda-automativa', 'vendaautomatica', 'vendaautomativa'],
  listtelefones: ['telefones'],
  // ferramentas
  'g-search': ['google-search'],
  'gerar-link': ['gera-link', 'to-link'],
  'get-lid': ['getlid', 'lid', 'meu-lid'],
  'info-msg': ['metadados', 'obter-metadados-mensagem', 'raw', 'raw-message'],
  link: ['linkgrupo'],
  uptime: ['up'],
  calendario: ['cale'],
  relatorio: ['relatório'],
  exemplos: ['exemplo-de-mensagem', 'exemplo-de-mensagens', 'exemplos-de-mensagens'],
  'exemplo-poll': ['poll-example'],
  // V31.3
  meme: ['bolsonaro'],
  sticker: ['s'],
  'embaçar': ['embaça', 'embaca', 'embacar'],
  'f-quote': ['f', 'fk', 'fq'],
  settoken: ['configurartoken'],
  migrartoken: ['migrartokens'],
  rn: ['renovar'],
  // gestão de grupos
  abrir: ['abre', 'abre-grupo', 'abrir-grupo', 'open', 'open-group', 'abri'],
  fechar: ['fecha', 'fechar-grupo', 'close', 'close-group', 'grupo-f', 'only-adm', 'only-admin', 'only-administrator', 'only-administrators', 'only-admins', 'so-admin', 'so-adm', 'so-administrador', 'so-administradores', 'so-admins'],
  fecharhorario: ['auto-fechar', 'autoclose', 'f-auto'],
  limpar: ['clear', 'clear-chat', 'limpa', 'limgroup', 'limpargrupo'],
  nome: ['mudar-nome-grupo', 'nome-grupo', 'set-group-name', 'set-name'],
  hidetag: ['hide-tag', 'to-tag', 'comunicar'],
  promover: ['promove', 'promote', 'add-adm', 'p'],
  rebaixar: ['rebaixa', 'demote'],
  revelar: ['reveal', 'rv'],
  kick: ['rm'],
  delete: ['del', 'd'],
  add: ['adicionar'],
  infogp: ['infogrupo'],
  // segurança
  mute: ['mutar'],
  unmute: ['desmutar'],
  antilink: ['anti-link'],
  antiflood: ['antispam'],
  antifake: [{ nome: 'antiestrangeiros-on', args: ['on'] }, { nome: 'antiestrangeiros-off', args: ['off'] }],
  automover: ['auto-remover'],
  periodoremocao: ['periodo-remocao'],
  statusremocao: ['status-remocao'],
  remover5: ['tirar5', 'rfantasmas5'],
  // automações / mensagens
  agendar: ['agendar-mensagem', 'alarme', 'setalarme', 'addalarme', 'adalarme', 'al'],
  boasvindas: ['boasvinda', 'boavinda', 'boavindas', 'bemvindo', 'boas', 'welcome', 'welkom', 'welkon'],
  saidas: ['saida', 'exit'],
  autoresposta: ['auto-responder'],
  nanolist: ['nanocomandos', 'listanano'],
};
