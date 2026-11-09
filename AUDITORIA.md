# AUDITORIA — SASUKE V31.3 — SHADOW GOD

Gerado em 2026-11-09T22:06:57.250Z · Node v22.23.4

> Testes feitos com um **WhatsApp simulado** (sem rede e sem Baileys). Validam lógica, permissões, aluguer, persistência e respostas. **Não** substituem o teste com uma conta real: ligação, Pairing Code, envio real de fotos, APIs externas e a estabilidade da sessão só se confirmam no WhatsApp.

Nomes no menu: **324** · comandos distintos: **198** · nomes registados (com atalhos): **331**

**Resumo:** ✅ 296 OK · 🟡 25 dependem de fonte externa/configuração · 🛡️ 3 recusa por regra · ⬜ 0 placeholders · ❌ 0 falhas

## Verificações

| Verificação | Resultado |
|---|---|
| todos os 324 nomes do menu têm comando | ✅ |
| "Comandos: 280+" é verdade (nomes registados ≥ 280) | ✅ |
| nenhum comando exige reaction (name/run obrigatórios; alias/desc/category normalizados) | ✅ |
| auto-comprovativo não é ficheiro separado (handleAuto dentro de comprovativo.js) | ✅ |
| nenhum número de pagamento (M-Pesa/e-Mola) fixo no código | ✅ |
| a reacção vem DEPOIS da resposta do comando | ✅ |
| comando sem reaction não reage e não dá erro | ✅ |
| safeReact ignora emoji inválido (duplo, texto, vazio, não-string) sem erro | ✅ |
| safeReact envia 1 emoji válido | ✅ |
| se a reacção falhar, o comando continua e o bot não quebra | ✅ |
| sem permissão: avisa e reage ❌ sem quebrar | ✅ |
| .menu sem foto: erro explícito + texto EXACTO do menu | ✅ |
| .menu com foto: legenda + texto juntos formam o texto EXACTO | ✅ |
| .help é atalho do .menu | ✅ |
| .pagamento sem configuração: mensagem pedida | ✅ |
| pagamento do grupo A e do grupo B ficam separados | ✅ |
| auto-comprovativo desligado não gera o cartão de comprovativo | ✅ |
| M-Pesa: cartão com chave, valor e destino validado | ✅ |
| M-Pesa: notifica os admins do grupo (menção) e ensina aprovar/recusar | ✅ |
| M-Pesa: aviso ao cliente (pendente, admin confirma) | ✅ |
| fica em database/comprovativos.json como PENDENTE (nunca aprovado sozinho) | ✅ |
| referência repetida: sinalizada e sem novo registo | ✅ |
| destino fora dos números do grupo: sinalizado | ✅ |
| comprovativo antigo: sinalizado | ✅ |
| e-Mola: cartão com operadora, chave, valor e destino validado | ✅ |
| e-Mola: destino fora dos números e-Mola: sinalizado | ✅ |
| mensagens de admins são ignoradas | ✅ |
| texto normal não é comprovativo | ✅ |
| .comprovativo VALOR REFERENCIA + foto: regista e guarda a foto em comprovativos/ | ✅ |
| .comprovativo: não duplica a mesma referência | ✅ |
| .comprovativo pendentes (admin) lista os pendentes | ✅ |
| membro não vê pendentes | ✅ |
| .comprovativo aprovar ID (só admin) aprova | ✅ |
| .comprovativo recusar ID recusa com motivo | ✅ |
| não aprova duas vezes | ✅ |
| antilink apaga e avisa | ✅ |
| antipalavrao apaga palavrão | ✅ |
| antifoto apaga imagem | ✅ |
| administradores são isentos | ✅ |
| antiflood reage a rajadas | ✅ |
| mute apaga mensagens de silenciados | ✅ |
| nano responde ao gatilho | ✅ |
| antidelete repõe mensagem apagada (já recebida) | ✅ |
| .remover5 mostra candidatos antes de remover | ✅ |
| .remover5 confirmar remove só membros comuns (nunca admins, dono nem bot) | ✅ |
| .agendar: mensagem devida aparece uma vez e a "única" é removida | ✅ |
| boas-vindas enviadas com menção | ✅ |
| despedida (saída voluntária) | ✅ |
| antifake remove números fora do +258 | ✅ |
| link do canal está configurado | ✅ |
| .canal manda o link (também em grupo sem aluguer) | ✅ |
| grupo nunca alugado: aviso com o link do canal | ✅ |
| falta 1 dia: detectado uma vez | ✅ |
| texto "Falta 1 dia" exacto | ✅ |
| expirou: texto exacto e comandos bloqueados | ✅ |
| expirado: .menu continua a funcionar (free) | ✅ |
| renovar volta a desbloquear | ✅ |
| 0 placeholders: nenhum comando "sem função" | ✅ |
| .picos sem compras: "Ninguém comprou ainda" | ✅ |
| .picos mostra o ranking (compras.json confirmadas) | ✅ |
| .picospv envia o ranking no privado do admin | ✅ |
| .semcompra lista quem não comprou (sem admins) | ✅ |
| .depositar regista PENDENTE em comprovativos.json e avisa os admins | ✅ |
| .faltacompra mostra o depósito pendente | ✅ |
| .rec mostra o recibo do depósito | ✅ |
| .rec sem comprovativos avisa | ✅ |
| aprovar depósito (sem valor) funciona e .relatorio não quebra | ✅ |
| .addsaldo adiciona à carteira do cliente | ✅ |
| .saldo mostra a carteira do grupo | ✅ |
| .restanas lista saldos | ✅ |
| .addsaldo não deixa o saldo ficar negativo | ✅ |
| .limparrestanas confirmar zera os saldos | ✅ |
| .chave (admin) mostra o pagamento configurado | ✅ |
| .chave sem configuração manda configurar | ✅ |
| .chave: membro sem permissão | ✅ |
| .pb e .px são atalhos de .pagamento | ✅ |
| .ban-senha bane e guarda o motivo | ✅ |
| .addgp autoriza o grupo | ✅ |
| modo "só grupos autorizados": ignora os outros e serve os autorizados | ✅ |
| .rn (membro) mostra como renovar com o link do canal | ✅ |
| .renovar/.rn (dono) renova o aluguer | ✅ |
| anticoncorrencia apaga anúncio de venda com contacto | ✅ |
| anticoncorrencia não apanha clientes | ✅ |
| .cadeia prende e depois solta | ✅ |
| .embaça/.embacar marcam a pessoa | ✅ |
| .f-quote cita a mensagem real com o autor verdadeiro (nunca outro) | ✅ |
| .f só cita as palavras de quem o usa | ✅ |
| .ad chama os admins; cooldown evita spam | ✅ |
| .app mostra informação e o canal | ✅ |
| .tempo mostra uptime e hora de Maputo | ✅ |
| .ti mostra versão e dono | ✅ |
| .buttons mostra o painel | ✅ |
| .token (dono, privado) gera e guarda em database/token.json (permissões 600) | ✅ |
| .token repetido mostra o mesmo token | ✅ |
| .token novo gera outro | ✅ |
| .token nunca aparece em grupo nem para membros | ✅ |
| .settoken valida o formato e .configurartoken é atalho | ✅ |
| .migrartoken roda o token e o anterior vale mais 24 h | ✅ |
| token antigo ainda é aceite durante a migração e um falso não | ✅ |
| .s sem foto avisa "responde a uma foto" | ✅ |
| .s transforma a foto numa figurinha WebP | ✅ |
| .mirror devolve a imagem espelhada | ✅ |
| .upload (dono) guardou o ficheiro em assets/ | ✅ |
| .upload só o dono | ✅ |
| anular desactiva o aluguer | ✅ |

## Todos os nomes do menu

| Nome | Comando | Resultado |
|---|---|---|
| .menu | principal | ✅ OK |
| .compra | principal | ✅ OK |
| .comprovativo | principal | ✅ OK |
| .megas | principal | ✅ OK |
| .verificarsms | principal | ✅ OK |
| .ola | principal | ✅ OK |
| .info | → .sobre | ✅ OK |
| .adm | → .admins | ✅ OK |
| .ajuda | → .menu | ✅ OK |
| .criador | → .dono | ✅ OK |
| .dono | principal | ✅ OK |
| .cep | principal | 🟡 externo/config |
| .chave | principal | ✅ OK |
| .extrair | principal | ✅ OK |
| .g-search | principal | 🟡 externo/config |
| .gera-link | → .gerar-link | ✅ OK |
| .gerar-link | principal | ✅ OK |
| .get-lid | principal | ✅ OK |
| .google-search | → .g-search | 🟡 externo/config |
| .info-msg | principal | ✅ OK |
| .link | principal | ✅ OK |
| .metadados | → .info-msg | ✅ OK |
| .obter-metadados-mensagem | → .info-msg | ✅ OK |
| .raw | → .info-msg | ✅ OK |
| .raw-message | → .info-msg | ✅ OK |
| .to-link | → .gerar-link | ✅ OK |
| .verificar | → .verificarsms | ✅ OK |
| .enviar-gif-de-buffer | principal | 🟡 externo/config |
| .enviar-gif-de-url | principal | 🟡 externo/config |
| .enviar-imagem-de-arquivo | principal | 🟡 externo/config |
| .enviar-imagem-de-buffer | principal | 🟡 externo/config |
| .enviar-imagem-de-url | principal | 🟡 externo/config |
| .enviar-lista | principal | ✅ OK |
| .enviar-reacoes | principal | ✅ OK |
| .enviar-resposta | principal | ✅ OK |
| .enviar-texto | principal | ✅ OK |
| .enviar-video-de-arquivo | principal | 🟡 externo/config |
| .enviar-video-de-buffer | principal | 🟡 externo/config |
| .enviar-video-de-url | principal | 🟡 externo/config |
| .exemplo-de-mensagem | → .exemplos | ✅ OK |
| .exemplo-de-mensagens | → .exemplos | ✅ OK |
| .exemplo-poll | principal | ✅ OK |
| .exemplos | principal | ✅ OK |
| .exemplos-de-mensagens | → .exemplos | ✅ OK |
| .funcoes-grupo | principal | ✅ OK |
| .imenu | → .menu | ✅ OK |
| .obter-dados-grupo | principal | ✅ OK |
| .poll-example | → .exemplo-poll | ✅ OK |
| .ad | principal | ✅ OK |
| .antifoto | principal | ✅ OK |
| .antispam | → .antiflood | ✅ OK |
| .app | principal | ✅ OK |
| .ban-senha | principal | ✅ OK |
| .bolsonaro | → .meme | 🟡 externo/config |
| .buttons | principal | ✅ OK |
| .cadeia | principal | ✅ OK |
| .calcula | principal | ✅ OK |
| .embaça | → .embaçar | ✅ OK |
| .embaçar | principal | ✅ OK |
| .f | → .f-quote | ✅ OK |
| .f-quote | principal | ✅ OK |
| .fk | → .f-quote | ✅ OK |
| .fq | → .f-quote | ✅ OK |
| .getlid | → .get-lid | ✅ OK |
| .lid | → .get-lid | ✅ OK |
| .linkgrupo | → .link | ✅ OK |
| .list | → .menu | ✅ OK |
| .m-pesa | → .pagamento | ✅ OK |
| .menubot | → .menu | ✅ OK |
| .meu-lid | → .get-lid | ✅ OK |
| .mirror | principal | ✅ OK |
| .mpesa | → .pagamento | ✅ OK |
| .pagamento | principal | ✅ OK |
| .payment | → .pagamento | ✅ OK |
| .pb | → .pagamento | ✅ OK |
| .px | → .pagamento | ✅ OK |
| .rec | principal | ✅ OK |
| .rn | principal | ✅ OK |
| .s | → .sticker | ✅ OK |
| .tempo | principal | ✅ OK |
| .ti | principal | ✅ OK |
| .up | → .uptime | ✅ OK |
| .upload | principal | ✅ OK |
| .uptime | principal | ✅ OK |
| .alugar | principal | ✅ OK |
| .bot | → .status | ✅ OK |
| .depositar | principal | ✅ OK |
| .faltacompra | principal | ✅ OK |
| .picos | principal | ✅ OK |
| .restanas | principal | ✅ OK |
| .semcompra | principal | ✅ OK |
| .setmegas | principal | ✅ OK |
| .telefones | → .listtelefones | ✅ OK |
| .venda-automatica | → .auto-comprovativo | ✅ OK |
| .venda-automativa | → .auto-comprovativo | ✅ OK |
| .abre | → .abrir | ✅ OK |
| .abre-grupo | → .abrir | ✅ OK |
| .abrir | principal | ✅ OK |
| .abrir-grupo | → .abrir | ✅ OK |
| .addgp | principal | ✅ OK |
| .auto-fechar | → .fecharhorario | ✅ OK |
| .clear | → .limpar | ✅ OK |
| .clear-chat | → .limpar | ✅ OK |
| .close | → .fechar | ✅ OK |
| .close-group | → .fechar | ✅ OK |
| .delete | principal | ✅ OK |
| .fecha | → .fechar | ✅ OK |
| .fechar | principal | ✅ OK |
| .fechar-grupo | → .fechar | ✅ OK |
| .grupo | principal | ✅ OK |
| .grupo-f | → .fechar | ✅ OK |
| .hide-tag | → .hidetag | ✅ OK |
| .kick | principal | ✅ OK |
| .limpar | principal | ✅ OK |
| .mudar-nome-grupo | → .nome | ✅ OK |
| .nome-grupo | → .nome | ✅ OK |
| .open | → .abrir | ✅ OK |
| .open-group | → .abrir | ✅ OK |
| .promove | → .promover | ✅ OK |
| .promover | principal | ✅ OK |
| .rebaixa | → .rebaixar | ✅ OK |
| .rebaixar | principal | ✅ OK |
| .reveal | → .revelar | ✅ OK |
| .revelar | principal | ✅ OK |
| .set-group-name | → .nome | ✅ OK |
| .set-name | → .nome | ✅ OK |
| .to-tag | → .hidetag | ✅ OK |
| .anti-link | → .antilink | ✅ OK |
| .anticoncorrencia | principal | ✅ OK |
| .antiestrangeiros-off | → .antifake | ✅ OK |
| .antiestrangeiros-on | → .antifake | ✅ OK |
| .ban | principal | ✅ OK |
| .desmutar | → .unmute | ✅ OK |
| .mutar | → .mute | ✅ OK |
| .mute | principal | ✅ OK |
| .only-adm | → .fechar | ✅ OK |
| .only-admin | → .fechar | ✅ OK |
| .periodo-remocao | → .periodoremocao | ✅ OK |
| .remover5 | principal | 🛡️ regra |
| .rfantasmas5 | → .remover5 | 🛡️ regra |
| .so-admin | → .fechar | ✅ OK |
| .status-remocao | → .statusremocao | ✅ OK |
| .tirar5 | → .remover5 | 🛡️ regra |
| .agendar | principal | ✅ OK |
| .agendar-mensagem | → .agendar | ✅ OK |
| .alarme | → .agendar | ✅ OK |
| .auto-comprovativo | principal | ✅ OK |
| .auto-remover | → .automover | ✅ OK |
| .auto-responder | → .autoresposta | ✅ OK |
| .autoclose | → .fecharhorario | ✅ OK |
| .autocomprovativo | → .auto-comprovativo | ✅ OK |
| .bemvindo | → .boasvindas | ✅ OK |
| .boas | → .boasvindas | ✅ OK |
| .calendario | principal | ✅ OK |
| .exit | → .saidas | ✅ OK |
| .nanoadd | principal | ✅ OK |
| .nanocomandos | → .nanolist | ✅ OK |
| .nanodel | principal | ✅ OK |
| .saida | → .saidas | ✅ OK |
| .setalarme | → .agendar | ✅ OK |
| .welcome | → .boasvindas | ✅ OK |
| .welkom | → .boasvindas | ✅ OK |
| .welkon | → .boasvindas | ✅ OK |
| .abri | → .abrir | ✅ OK |
| .adalarme | → .agendar | ✅ OK |
| .add | principal | ✅ OK |
| .add-adm | → .promover | ✅ OK |
| .addalarme | → .agendar | ✅ OK |
| .addsaldo | principal | ✅ OK |
| .addtelefone | principal | ✅ OK |
| .adicionar | → .add | ✅ OK |
| .al | → .agendar | ✅ OK |
| .anularcompra | principal | ✅ OK |
| .ativarcompras | principal | ✅ OK |
| .boasvinda | → .boasvindas | ✅ OK |
| .boasvindas | principal | ✅ OK |
| .boavinda | → .boasvindas | ✅ OK |
| .boavindas | → .boasvindas | ✅ OK |
| .cale | → .calendario | ✅ OK |
| .checkrecibo | → .verificarrecibo | ✅ OK |
| .compras | → .compra | ✅ OK |
| .comunicar | → .hidetag | ✅ OK |
| .configurartoken | → .settoken | ✅ OK |
| .d | → .delete | ✅ OK |
| .debugrecibo | principal | ✅ OK |
| .del | → .delete | ✅ OK |
| .deltelefone | principal | ✅ OK |
| .demote | → .rebaixar | ✅ OK |
| .f-auto | → .fecharhorario | ✅ OK |
| .infogrupo | → .infogp | ✅ OK |
| .limgroup | → .limpar | ✅ OK |
| .limpa | → .limpar | ✅ OK |
| .limparcompras | principal | ✅ OK |
| .limpargrupo | → .limpar | ✅ OK |
| .limparrestanas | principal | ✅ OK |
| .listanano | → .nanolist | ✅ OK |
| .listtelefones | principal | ✅ OK |
| .migrartoken | principal | ✅ OK |
| .migrartokens | → .migrartoken | ✅ OK |
| .only-administrator | → .fechar | ✅ OK |
| .only-administrators | → .fechar | ✅ OK |
| .only-admins | → .fechar | ✅ OK |
| .p | → .promover | ✅ OK |
| .pagamentos | → .pagamento | ✅ OK |
| .periodoremocao | principal | ✅ OK |
| .picospv | principal | ✅ OK |
| .promote | → .promover | ✅ OK |
| .relatório | → .relatorio | ✅ OK |
| .rm | → .kick | ✅ OK |
| .rv | → .revelar | ✅ OK |
| .settoken | principal | ✅ OK |
| .sms | → .verificarsms | ✅ OK |
| .so-adm | → .fechar | ✅ OK |
| .so-administrador | → .fechar | ✅ OK |
| .so-administradores | → .fechar | ✅ OK |
| .so-admins | → .fechar | ✅ OK |
| .statusremocao | principal | ✅ OK |
| .token | principal | ✅ OK |
| .unmute | principal | ✅ OK |
| .vendaautomatica | → .auto-comprovativo | ✅ OK |
| .vendaautomativa | → .auto-comprovativo | ✅ OK |
| .verificarrecibo | principal | ✅ OK |
| .banlist | principal | ✅ OK |
| .unban | principal | ✅ OK |
| .admins | principal | ✅ OK |
| .membros | principal | ✅ OK |
| .online | principal | ✅ OK |
| .abrirhorario | principal | ✅ OK |
| .fecharhorario | principal | ✅ OK |
| .nome | principal | ✅ OK |
| .desc | principal | ✅ OK |
| .novolink | principal | ✅ OK |
| .infogp | principal | ✅ OK |
| .nanobemvindo | principal | ✅ OK |
| .saidas | principal | ✅ OK |
| .nanosaida | principal | ✅ OK |
| .autoresposta | principal | ✅ OK |
| .hidetag | principal | ✅ OK |
| .marcar | principal | ✅ OK |
| .dectetor | principal | ✅ OK |
| .nano | principal | ✅ OK |
| .nanolist | principal | ✅ OK |
| .limparnano | principal | ✅ OK |
| .antilink | principal | ✅ OK |
| .antilinkhard | principal | ✅ OK |
| .anticanal | principal | ✅ OK |
| .antivideo | principal | ✅ OK |
| .antiaudio | principal | ✅ OK |
| .antisticker | principal | ✅ OK |
| .antidoc | principal | ✅ OK |
| .antiviewonce | principal | ✅ OK |
| .antifake | principal | ✅ OK |
| .antiflood | principal | ✅ OK |
| .antipalavrao | principal | ✅ OK |
| .antidelete | principal | ✅ OK |
| .automover | principal | ✅ OK |
| .maxavisos | principal | ✅ OK |
| .tabela | principal | ✅ OK |
| .contas | principal | ✅ OK |
| .carteira | principal | ✅ OK |
| .loja | principal | ✅ OK |
| .saldo | principal | ✅ OK |
| .addmpesa | principal | ✅ OK |
| .addemola | principal | ✅ OK |
| .antiburlador | principal | ✅ OK |
| .liberartodos | principal | ✅ OK |
| .liberar | principal | ✅ OK |
| .clientes | principal | ✅ OK |
| .modolivre | principal | ✅ OK |
| .bloqueartodos | principal | ✅ OK |
| .permissoes | principal | ✅ OK |
| .tirardias | principal | ✅ OK |
| .anular | principal | ✅ OK |
| .alugueis | principal | ✅ OK |
| .conectar | principal | ✅ OK |
| .qrcode | principal | ✅ OK |
| .sessoes | principal | ✅ OK |
| .bangp | principal | ✅ OK |
| .sasuke | principal | 🟡 externo/config |
| .naruto | principal | 🟡 externo/config |
| .itachi | principal | 🟡 externo/config |
| .waifu | principal | 🟡 externo/config |
| .anime | principal | 🟡 externo/config |
| .wallpaper | principal | 🟡 externo/config |
| .quote | principal | 🟡 externo/config |
| .amv | principal | 🟡 externo/config |
| .otaku | principal | ✅ OK |
| .madara | principal | 🟡 externo/config |
| .kakashi | principal | 🟡 externo/config |
| .sakura | principal | 🟡 externo/config |
| .hinata | principal | 🟡 externo/config |
| .obito | principal | 🟡 externo/config |
| .sobre | principal | ✅ OK |
| .ping | principal | ✅ OK |
| .perfil | principal | ✅ OK |
| .canal | principal | ✅ OK |
| .dado | principal | ✅ OK |
| .moeda | principal | ✅ OK |
| .8ball | principal | ✅ OK |
| .ranking | principal | ✅ OK |
| .beijar | principal | ✅ OK |
| .abraçar | principal | ✅ OK |
| .socar | principal | ✅ OK |
| .style-menu | principal | ✅ OK |
| .jutsu | principal | ✅ OK |
| .sharingan | principal | ✅ OK |
| .ship | principal | ✅ OK |
| .casal | principal | ✅ OK |
| .daily | principal | ✅ OK |
| .settabela | principal | ✅ OK |
| .setpagamento | principal | ✅ OK |
| .setcontas | principal | ✅ OK |
| .setcarteira | principal | ✅ OK |
| .setcompra | principal | ✅ OK |
| .setloja | principal | ✅ OK |
| .vertabela | principal | ✅ OK |
| .limpartabela | principal | ✅ OK |
| .verloja | principal | ✅ OK |
| .qr | principal | ✅ OK |
| .pairing | principal | ✅ OK |
| .pair | principal | ✅ OK |
| .code | principal | ✅ OK |
| .desconectar | principal | ✅ OK |
| .status | principal | ✅ OK |
