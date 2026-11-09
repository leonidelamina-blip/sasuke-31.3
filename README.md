# 🩸 SASUKE V31.3 — SHADOW GOD
**CORE 77 · Node.js + @whiskeysockets/baileys** — bot WhatsApp para **aluguer por grupo**. Mesma ideia da V31.1, com comprovativos por grupo, avisos de aluguer com o canal, conexão e novos comandos.

## O que mudou da V31.1
- **Reacção opcional e segura:** o campo `reaction` pode não existir ou ser `null`. O comando corre PRIMEIRO; só depois o bot tenta reagir (`safeReact`, sempre dentro de try/catch; só 1 emoji válido). Uma reacção nunca quebra um comando.
- **Sem erro "sem categoria":** só `name` e `run` são obrigatórios; `alias`, `desc` e `category` têm valores por defeito. Ficheiros com erro e ficheiros ocultos/estranhos são ignorados (aviso no log) e o bot continua.
- **Comprovativos por grupo** (`src/commands/comprovativo.js`): leitura automática de SMS M-Pesa/e-Mola (`handleAuto`, corre antes dos comandos), registo manual com foto, pendentes/aprovar/recusar. Dados em `database/comprovativos.json`; fotos em `comprovativos/`.
- **Nenhum número de pagamento no código.** Cada grupo configura o seu com `.setpagamento`, `.setcontas`, `.setcarteira`, `.addmpesa`, `.addemola`.
- **Aluguer:** "Falta 1 dia, renova no canal: …" e "Aluguer expirado, entra no canal para renovar: …"; expirado = comandos bloqueados até renovar. `.canal` manda sempre o link.
- **Conexão** (só dono): `.qr .pairing .pair .code .conectar .desconectar .status .sessoes .qrcode`.
- **Menu exacto** (`src/data/menu.txt`) e **atalhos** centralizados em `src/data/aliases.js`.
- **Sessão protegida:** pasta `auth/` própria e bloqueio contra duas instâncias a usar a mesma sessão.

## Instalação (bot-hosting.net / Termux)
_(O pacote `sharp` é opcional: se não instalar, as figurinhas usam o ffmpeg do servidor, se existir.)_
1. Envia o **zip inteiro** e extrai-o no painel (o `package.json` e o `index.js` na raiz). Node 20+.
2. `npm install` (o ficheiro `.npmrc` com `allow-git=all` é necessário porque o Baileys usa uma dependência do GitHub). Arranque: `npm start` (ficheiro `index.js`).
3. `node scripts/verificar.js` diz se falta algum ficheiro ou se há ficheiros estranhos em `src/commands`.
4. A consola mostra o **código de emparelhamento** (8 caracteres). WhatsApp da conta do bot › Aparelhos conectados › Conectar com número de telefone. O código expira em ~1 minuto.
5. Põe o bot num grupo, torna-o **administrador** e, nesse grupo, o dono usa `.alugar 30`.
- **Re-emparelhar:** pára o bot, apaga a pasta `auth/`, liga outra vez.
- **"Bad MAC" / sessão a cair:** costuma ser duas instâncias com a mesma sessão, ou ficheiros de `auth/` copiados/editados. Mantém UMA instância, não mexas em `auth/` com o bot ligado e, se persistir, apaga `auth/` e emparelha de novo. Não consigo garantir que nunca aconteça (depende também do WhatsApp).

## Como testar (por esta ordem)
1. `.menu` — foto do Sasuke + menu exacto (precisa de `assets/sasuke.jpg`; sem ela o bot avisa e envia o texto).
2. `.canal` — link do canal (funciona em qualquer grupo).
3. `.ping` — latência real, uptime e estado.
4. `.setpagamento <texto do teu pagamento>` e `.pagamento` — mostra o pagamento DAQUELE grupo. Depois `.addmpesa [SEU-NUMERO] Nome` / `.addemola [SEU-NUMERO] Nome`.
5. `.auto-comprovativo on`, cola um SMS de comprovativo → cartão + aviso ao cliente + admins marcados.
6. `.comprovativo pendentes` · `.comprovativo aprovar ID` · `.comprovativo recusar ID`.
7. Foto: envia a foto com a legenda `.comprovativo VALOR REFERENCIA`.

## Comprovativos — limites honestos
O bot só **lê o texto** do SMS (M-Pesa e e-Mola) e valida o destino contra os números do grupo. Um SMS falso copiado pode parecer igual: por isso fica sempre **PENDENTE** até um administrador aprovar depois de ver o pagamento na app da operadora. Outras operadoras: usa `.comprovativo VALOR REFERENCIA` (+ foto).

## V31.3 — os 40 antigos placeholders já têm função
| Comando | O que faz |
|---|---|
| `.meme` (`.bolsonaro`) | meme aleatório inofensivo (fonte pública), reacção 🤣. Não faz piada com pessoas reais |
| `.picos` / `.picospv` | ranking de quem mais comprou (compras confirmadas); "Ninguém comprou ainda" se não houver / envia no privado |
| `.token` · `.settoken` (`.configurartoken`) · `.migrartoken(s)` | só dono e **só no privado**; token em `database/token.json` (perm. 600); rodar mantém o antigo válido 24 h. Nada o usa ainda (não há painel) |
| `.depositar 100Mb` | regista depósito PENDENTE em `comprovativos.json` e avisa os admins (aprovar com `.comprovativo aprovar ID`) |
| `.embaça` `.embaçar` `.embaca` `.embacar` | "embaçou 😶‍🌫️" + marca a pessoa |
| `.s` (`.sticker`) | foto/vídeo curto → figurinha (precisa de **ffmpeg** ou do pacote **sharp** no servidor) |
| `.mirror` | espelha a foto (mesmos requisitos) |
| `.app` · `.tempo` · `.ti` · `.buttons` | info do app · uptime + hora de Maputo · info do bot · painel de "botões" em texto |
| `.ban-senha @pessoa` | admin bane e regista o motivo "vazou a senha do grupo" |
| `.cadeia @pessoa` | brincadeira: "preso" 1 minuto e depois "solto" (não bloqueia ninguém) |
| `.chave` | admin: mostra o pagamento configurado (`.setpagamento`, `.addmpesa`, `.addemola`) ou manda configurar |
| `.f` `.f-quote` `.fk` `.fq` | cartão de citação da mensagem respondida (autor verdadeiro) ou das tuas palavras. **Não** cria mensagens falsas de outras pessoas |
| `.pb` `.px` | atalhos de `.pagamento` |
| `.rec` | o teu último comprovativo/recibo no grupo (com a foto, se houver) |
| `.rn` (`.renovar`) | dono renova o aluguer; os outros veem como renovar |
| `.upload nome` | dono: guarda a foto em `assets/` (`sasuke`, `dono`, `padrao`, `anime/itachi`, `anime/wallpapers/w1`, vídeo em `amv/x`) |
| `.addgp` | dono: lista de grupos autorizados (`.addgp`, `.addgp remover`, `.addgp lista`). Com `soGruposAutorizados: true` no `config.json`, o bot ignora os outros |
| `.addsaldo @pessoa 100 [unidade]` | admin: saldo/megas na carteira do cliente (registo interno; `.saldo`, `.restanas`, `.limparrestanas confirmar`) |

**Definições minhas (revê):** `.ad` chama os admins · `.anticoncorrencia` apaga anúncios "vendo…" com contacto · `.d` = `.delete` · `.p` = `.promover` · `.f-auto` = `.fecharhorario` · `.semcompra` quem nunca comprou · `.faltacompra` quem tem pedidos pendentes · `.restanas` clientes com saldo · `.limparrestanas` zera saldos · `.picospv` ranking no privado · `.migrartoken(s)` roda o token.

## Estrutura
`index.js` · `config.json` · `database/` (JSON por grupo) · `comprovativos/` (fotos) · `auth/` (sessão) · `assets/` · `src/commands` (um ficheiro por tema) · `src/data` (menu e atalhos) · `src/handlers` · `src/protections` · `src/services` · `src/utils` · `scripts/`.
Novo comando: copia `src/commands/_template.js`. Campos: `name`, `run` (obrigatórios) e `alias`, `desc`, `category`, `reaction` (opcionais).

## Testes
`npm test` (módulos) · `npm run auditoria` (corre todos os nomes do menu com um WhatsApp **simulado** e gera `AUDITORIA.md`). Não substituem o teste com uma conta real.
