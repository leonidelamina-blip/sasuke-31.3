'use strict';
/**
 * MODELO DE COMANDO (ignorado pelo carregador por começar com "_").
 * Um ficheiro pode exportar um comando ou um array de comandos.
 *
 * Contrato:
 *   name        string   obrigatório, minúsculas, sem prefixo
 *   aliases     string[] opcional
 *   categoria   string   obrigatório (usada no menu)
 *   descricao   string   opcional (usada no menu / auditoria)
 *   reaction    string   obrigatório (emoji antes da resposta)
 *   level       'membro' | 'cliente' | 'admin' | 'dono'   (por defeito 'membro')
 *   groupOnly   boolean  só funciona em grupos
 *   botAdmin    boolean  exige que o bot seja admin do grupo
 *   free        boolean  funciona em grupos sem aluguer activo (.menu, .dono, .sobre, ...)
 *   nuncaLiberar boolean .liberar / .modolivre não podem baixar o nível deste comando
 *   run(ctx)    async    execução. Lançar Error com .userMessage mostra a mensagem ao utilizador.
 *
 * ctx: sock, msg, jid, isGroup, sender, number, pushName, text, command, args, argText,
 *      meta, isOwner, isAdmin, botIsAdmin, level, mentioned, quotedSender, quotedMessage,
 *      config, db, perms, rental, scheduler,
 *      send(content, opts), reply(texto), react(emoji), groupConfig(), refreshMeta()
 *
 * Todo o envio passa por ctx.send / ctx.reply / ctx.scheduler (Human Response System).
 */
module.exports = {
  name: 'exemplo',
  categoria: 'Geral',
  descricao: 'Modelo — não é carregado.',
  reaction: '⚡',
  level: 'membro',
  async run(ctx) {
    await ctx.reply('Exemplo.');
  },
};
