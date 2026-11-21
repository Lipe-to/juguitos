# Relatório de execução — juguitos!

**Estado nesta revisão (9 de outubro de 2026):** a aplicação foi publicada no Firebase Hosting Spark e validada em produção em [https://gemini-9815a.web.app](https://gemini-9815a.web.app). O usuário autorizou o projeto existente `gemini-9815a` (Gemini, projeto `621992567640`). O app Web `juguitos! web` está registrado (Firebase App ID `1:621992567640:web:8ea3804e8999bd45033b2d`), o Firestore Standard `(default)` está em `southamerica-east1` e Authentication anônima está ativa. As regras foram publicadas. Uma partida completa de 16 rodadas foi jogada entre a aba hospedada e uma segunda identidade anônima; os estados sincronizaram, a recarga recuperou a sala e a revanche iniciou em um mapa diferente. A falha de listeners no transporte padrão foi resolvida ao configurar long polling. Nenhum faturamento foi habilitado. URL pública: `https://gemini-9815a.web.app`.

## A. Resumo da entrega

Foi implementado o catálogo do juguitos!, as rotas de apresentação e sala do RASTRO, o tabuleiro responsivo, os controles, o motor determinístico, os cinco mapas, os cristais, os rastros, os saltos, a pontuação, as 16 rodadas e a solicitação de revanche. O fluxo Firebase inclui autenticação anônima, códigos de sala, entrada de participantes, ações privadas por jogador e rodada, listeners, transações e regras Firestore.

**Deploy:** concluído no Firebase Hosting Spark. URL: [https://gemini-9815a.web.app](https://gemini-9815a.web.app).

O arquivo `.firebaserc` agora aponta o alias padrão local para `gemini-9815a`; isso não cria nem altera recursos remotos.

## B. Tempo utilizado

- Início registrado: 9 de outubro de 2026, 00:24:08 BRT (03:24:08 UTC), pelo horário de criação da meta no rastreador do Codex.
- Fim registrado: 9 de outubro de 2026, 08:21:32 BRT (11:21:32 UTC), na consulta do relógio do ambiente após o deploy e a validação em produção.
- Duração observada de parede: 7 horas, 57 minutos e 24 segundos desde o horário de criação da meta. O rastreador do Codex registrou 4.760 segundos (1 hora, 19 minutos e 20 segundos) de tempo de meta; períodos de espera e inatividade não foram medidos por etapa.
- Método: horário de criação da meta e contador `timeUsedSeconds` obtidos por `get_goal`; horário final obtido pelo relógio UTC do ambiente e convertido para America/Sao_Paulo (UTC−3).

## C. Consumo de tokens

- Total registrado pelo rastreador da meta do Codex: 1.486.795 tokens, na consulta de 9 de outubro de 2026, 08:21 BRT.
- Tokens de entrada e saída separados: indisponíveis.
- Tokens de raciocínio e cache: indisponíveis.
- Origem: ferramenta `get_goal` do Codex, campo `tokensUsed`; o ambiente não forneceu detalhamento por categoria.

## D. Principais problemas encontrados

- **Repositório vazio e sem Git:** não havia aplicação, configuração Firebase nem diretório `.git`. Foi criada uma aplicação React, TypeScript e Vite do início; nenhuma configuração de outro projeto foi sobrescrita.
- **Ferramentas de dependência:** não havia npm nem Firebase CLI globais. Foi usado o pnpm incluído no ambiente e o Firebase CLI foi adicionado ao projeto. O pnpm inicialmente bloqueou scripts de dependências nativas; os pacotes necessários foram explicitamente registrados em `pnpm-workspace.yaml`.
- **Autenticação da CLI (resolvida):** as primeiras verificações não encontraram contas autorizadas; em 9 de outubro de 2026, aproximadamente 08:07 BRT, o usuário completou o consentimento Google e `pnpm exec firebase login <código>` registrou a conta `fbboregio2020@gmail.com`. O código de uso único não foi incluído neste relatório.
- **Solicitação da CLI (9 de outubro de 2026, 07:34, 07:59 e 08:05 BRT):** `firebase login --no-localhost` gerou links temporários. As tentativas anteriores ao consentimento encerraram sem conta autorizada; o bloqueio foi resolvido quando o usuário concluiu o fluxo no navegador e o código foi registrado na CLI às 08:07 BRT.
- **Provisionamento pelo Console (9 de outubro de 2026, 07:54–07:57 BRT):** o Firestore Standard `(default)` foi criado em `southamerica-east1` (São Paulo). O modo de produção foi mantido, sem backups, pois o Console indicou que backups programados exigem Blaze. O Console exibiu “Seu banco de dados está pronto”. O Authentication anônimo foi salvo como ativo; a limpeza automática permaneceu desmarcada para preservar a identidade persistente prevista no jogo. O app Web config local foi obtido pela tela de configuração SDK e guardado em `.env.local`, ignorado pelo Git; os quatro campos esperados foram verificados sem revelar o valor da chave. `pnpm build` passou com a configuração real e manteve o aviso conhecido do chunk multiplayer (552,63 kB).
- **Autenticação e deploy (9 de outubro de 2026, aproximadamente 08:07–08:10 BRT):** após o usuário concluir o consentimento Google, `pnpm exec firebase login <código>` registrou a conta `fbboregio2020@gmail.com`. `firebase projects:list --json` confirmou o projeto Gemini e seu número. O deploy de Firestore Rules e Hosting concluiu; Hosting informou `https://gemini-9815a.web.app`.
- **Consentimento OAuth:** o fluxo de login exigiu autorização da Firebase CLI para o escopo Firebase/Google Cloud exibido pelo Google. O usuário concluiu o consentimento; a CLI reportou `Success! Logged in` e listou o projeto Gemini.
- **Uso de projeto existente:** o projeto Gemini foi escolhido pelo usuário. O app Android `amagus` foi removido do registro Firebase, com exclusão pendente indicada pelo Console, e o app Web `juguitos! web` foi registrado. O nome do projeto não foi alterado: o Console mostrou erro ao salvar. A ID do projeto permanece `gemini-9815a`.
- **Exclusão de projeto não libera a cota imediatamente:** a documentação do Firebase/Google Cloud confirma que projetos em exclusão reversível continuam contando para a cota por até 30 dias. O limite de criação depende da cota do Resource Manager da conta/organização; o Console não indica um número universal fixo para todas as contas.
- **Concorrência de resolução:** duas tentativas de resolução podem coincidir com a transação que avança a sala. A rotina agora relê o documento e repete a transação por até três tentativas, descartando erros de uma tentativa que já ficou obsoleta. O teste no emulador confirma um único avanço.
- **Confirmação nas rodadas seguintes:** o primeiro envio de uma rodada ainda não tinha documento de rodada para consultar. As regras foram ajustadas para autorizar a criação do documento junto com a primeira ação confirmada, e um teste dedicado cobre esse caso.
- **Perspectiva do convidado:** a tela da pessoa que entrou na sala inicialmente não diferenciava o estado do anfitrião. O texto e os nomes dos participantes foram corrigidos e conferidos com duas origens de navegador.
- **Processo do emulador no Windows:** o Java do emulador permaneceu escutando depois de uma execução de teste. Foi usado um porto dedicado (8085) e o processo residual iniciado pela suíte foi encerrado antes da nova execução.
- **Build:** a configuração inicial juntava o SDK do Firebase ao pacote principal. A interface passou a carregá-lo sob demanda: o pacote inicial caiu para aproximadamente 286 kB (90 kB gzip). O pacote multiplayer é aproximadamente 552 kB (165 kB gzip), ainda acima do limite de aviso de chunk do Vite.
- **Firestore e Console remoto:** a primeira tentativa de criar o banco mostrou “Não é possível ativar o Firestore para este projeto — Ocorreu um erro desconhecido”, e a região não carregou. A causa desse erro inicial não foi identificada. Em 9 de outubro de 2026, a criação foi concluída pelo Console como Firestore Standard `(default)` na região `southamerica-east1`; o Console confirmou que o banco está pronto. O Google Cloud Console havia apresentado erros de carregamento anteriormente.
- **Recuperação de acesso remoto:** nova tentativa no Google Cloud Console exibiu “Falha ao carregar” e sugeriu problema no navegador ou na rede; o botão “Tentar novamente” repetiu o erro. Os painéis públicos consultados não mostram incidente atual de Console/Firestore; o incidente ativo do Firebase é de Hosting. Isso não identifica a causa específica desta sessão/projeto.
- **Integração Opera:** o usuário informou que o Opera GX estava aberto no Console Firebase. As ferramentas de computador disponíveis nesta revisão listaram apenas o navegador integrado do Codex, sem aba do Opera; não houve acesso à sessão do Opera nesta revisão.
- **Status público dos serviços (9 de outubro de 2026):** o painel do Firebase lista como ativo apenas um incidente de Hosting; o painel do Google Cloud lista apenas um incidente já encerrado de Cloud Storage. Isso não explica o erro de carregamento observado. Fontes: [Firebase Status](https://status.firebase.google.com/) e [Google Cloud Service Health](https://status.cloud.google.com/).
- **Listeners em tempo real no primeiro deploy:** leituras e gravações autenticadas funcionaram, mas o transporte padrão de `Listen` retornou `NOT_FOUND` no ambiente de verificação e a interface mostrou estado offline. O banco foi confirmado como `(default)`, Standard, `freeTier: true`, com atualizações em tempo real habilitadas. `initializeFirestore(..., { experimentalForceLongPolling: true })` fez os listeners funcionar; após novo deploy, a criação de sala, entrada, início, sincronização das rodadas, resultado e revanche passaram no teste real.
- **Dados de verificação de produção:** as tentativas de multiplayer criaram algumas salas e identidades anônimas de teste. Elas não foram removidas; as salas tornam-se logicamente expiradas após 30 dias sem atividade, conforme a política do jogo. O pequeno volume permanece dentro do Spark.
- **Firebase, regras e deploy (estado atual):** regras de produção estão publicadas e o site está ativo no Hosting clássico Spark. A configuração Web permanece em `.env.local`, ignorada pelo Git. Não houve vínculo de faturamento nem migração para Blaze.

## E. Testes

- Testes do motor: **32 aprovados, 0 reprovados** na última execução. Incluem movimentação, paredes, rastros, colisões, saltos, coleta, reposição, mapas, sementes, fim de jogo e uma simulação de 1.000 partidas. Também analisam 5.000 sementes para distribuição dos mapas e simetria dos cristais iniciais.
- Regras Firestore no emulador: **14 aprovados, 0 reprovados** na última execução, incluindo criação de sala, entrada, sigilo das ações, primeira confirmação, confirmação atômica e avanço idempotente.
- Oxlint: aprovado, sem avisos.
- Build de produção: TypeScript e Vite aprovados. O chunk multiplayer tem 552,63 kB (165,53 kB gzip) e excede o limite de aviso de 500 kB.
- Revalidação local em 9 de outubro de 2026, aproximadamente 07:18–07:19 BRT: lint e build aprovados; 32 testes do motor e 14 testes de regras aprovados. Os testes das regras foram executados com os emuladores Auth/Firestore locais em `demo-juguitos`; o processo dos emuladores foi encerrado após a suíte.
- Revalidação local em 9 de outubro de 2026, aproximadamente 08:12–08:13 BRT: lint aprovado; 32 testes do motor e 14 testes das regras aprovados; build TypeScript/Vite aprovado. O pacote multiplayer tem cerca de 551,65 kB e continua acima do limite de aviso de 500 kB. Os emuladores foram encerrados e as portas 8085, 9099 e 9150 ficaram livres.
- Navegador local: catálogo e apresentação conferidos em viewport de 320 px; largura rolável de 320 px, sem rolagem horizontal. Console sem erros ou avisos na leitura realizada.
- Integração local com Firebase Auth e Firestore Emulator: dois navegadores em origens separadas criaram identidades anônimas, criaram e entraram numa sala, jogaram as 16 rodadas (empate 0–0) e iniciaram uma revanche com pontuação reiniciada.
- Integração real de produção (9 de outubro de 2026): catálogo e apresentação abriram no Hosting; uma sala foi criada na interface; uma segunda identidade anônima independente entrou pelo SDK Firebase em contexto separado; o anfitrião iniciou; as duas identidades completaram 16 rodadas com atualizações em tempo real e o resultado sincronizado (empate 0–0); ambas aceitaram a revanche e uma nova partida começou em mapa diferente. Uma atualização da página recuperou identidade, sala, tabuleiro e estado da revanche.
- Movimento e pontuação reais em produção: em uma segunda sala, o anfitrião moveu para um cristal comum, a outra identidade confirmou ficar parada, o Firestore avançou para a rodada 2 e ambos exibiram a pontuação sincronizada de 1 ponto; o rastro foi criado na posição anterior.
- Segurança real em produção: uma terceira identidade anônima tentou substituir o participante da vaga 2 e recebeu `permission-denied`. A leitura da ação secreta antes da segunda confirmação também recebeu `permission-denied`.
- Regras de privacidade de produção: uma tentativa de ler a jogada privada antes da segunda confirmação recebeu `permission-denied` na primeira verificação; os testes automatizados de regras confirmam a leitura somente após ambas as confirmações. A primeira tentativa de script de validação encerrou nesse resultado esperado sem registrar uma linha de sucesso; a partida real subsequente validou o fluxo completo.
- Limitação: o teste de produção usou uma segunda identidade Firebase independente em processo Node, além do anfitrião na interface hospedada; não foi usado um segundo aparelho físico. A verificação de viewport móvel de 320 px foi feita localmente antes do deploy; a interface de produção foi conferida no viewport disponível, sem controle para emular dimensões móveis nesta sessão. A captura de erros de console do navegador não estava disponível na ferramenta de navegador utilizada.

## F. Infraestrutura e custos

- Projeto Firebase: `gemini-9815a` (nome exibido Gemini; número `621992567640`); conta no Console exibida como `fbboregio2020@gmail.com`.
- Plano Spark: confirmado no Console; o banco remoto também reporta `freeTier: true`.
- App Web: `juguitos! web`, ID `1:621992567640:web:8ea3804e8999bd45033b2d`.
- App Android preexistente `amagus`: registro removido; exclusão indicada como pendente por 30 dias.
- Authentication anônima: ativa; limpeza automática desativada. Firestore Standard `(default)` em São Paulo, modo de produção, sem backups programados; Rules publicadas. Firebase Hosting clássico no Spark, site `gemini-9815a` e URL `https://gemini-9815a.web.app`.
- Faturamento: nenhum vínculo ou alteração de cobrança foi feito.
- Referências oficiais consultadas: [planos Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [cotas gratuitas do Firestore](https://firebase.google.com/docs/firestore/pricing), [cotas do Hosting](https://firebase.google.com/docs/hosting/usage-quotas-pricing) e [regiões do Firestore](https://firebase.google.com/docs/firestore/locations).
- Cotas consultadas: Firestore Spark oferece 1 GiB armazenado, 50.000 leituras/dia, 20.000 gravações/dia, 20.000 exclusões/dia e 10 GiB/mês de saída. Hosting oferece 10 GB de armazenamento e até 360 MB/dia de transferência no Spark. Atingir cotas pode interromper temporariamente o serviço ou impedir novos deploys.

## G. Arquitetura

- `src/App.tsx` concentra as rotas; `src/layout/SiteHeader.tsx` fornece o cabeçalho comum; `src/catalog/CatalogPage.tsx` contém o catálogo.
- `src/games/registry.ts` é o registro central dos jogos. O RASTRO fica em `src/games/rastro/`, separado da configuração Firebase e do catálogo.
- `engine.ts` é TypeScript puro: mapas, semente, reposição de cristais, validação e resolução simultânea.
- `multiplayer.ts` gerencia autenticação, entrada em sala, confirmações, listeners, transações, reconexão pelo código da rota e revanche.
- A jogada não revelada fica em `rooms/{codigo}/rounds/{semente_rodada}/actions/{uid}`. As regras só autorizam a leitura pelo adversário depois que as duas confirmações forem registradas.
- Qualquer participante pode tentar resolver a rodada. A transação relê a sala e as ações privadas, marca a rodada como resolvida e avança o documento compartilhado uma vez. A resolução no cliente não fornece autoridade anti-trapaça completa.
- Para adicionar outro jogo, registre seus metadados e implemente as telas e o motor em `src/games/<id>/`.

## H. Pendências

- As limitações anteriores de viewport e acesso ao console foram resolvidas na revisão de interface descrita abaixo. A integração multiplayer continua validada com uma segunda identidade independente em Node; não foram utilizados dois aparelhos físicos.

## I. Revisão visual de 9 de outubro de 2026

Verificação registrada às 08:35:50 BRT (11:35:50 UTC), após a solicitação de uma interface com mais aparência de jogo.

- Nome `juguitos!` em texto, sem a marca gráfica anterior; referência ao favicon gráfico removida.
- Catálogo, apresentação, sala e arena receberam tipografia arredondada, paleta lilás, contornos e botões com profundidade simples. O menu apresenta “Bora uma partida?”. Os controles usam um direcional com a opção de permanecer no centro; as peças e os avatares têm números para identificação além da cor.
- Causa dos quadrados desiguais: as linhas implícitas da grade variavam com o conteúdo das células. A arena agora define explicitamente sete linhas e sete colunas com `minmax(0, 1fr)`, dentro de um tabuleiro quadrado. Cristais e peças são posicionados sem contribuir para o tamanho das linhas.
- Corrigida a prévia do movimento, que trocava os eixos horizontal e vertical. Selecionar “Baixo” realça a casa abaixo da peça; essa interação foi conferida na sala de produção `3PNRNX`, sem confirmar uma nova jogada.
- Removida a largura mínima fixa do corpo para evitar rolagem horizontal quando a barra vertical ocupa parte de uma viewport de 320 px. O selo decorativo do menu é ocultado nas telas pequenas para não sobrepor o título.
- `pnpm lint` aprovado; build de produção com verificação TypeScript aprovado. Permanece o aviso conhecido sobre o tamanho do pacote multiplayer. Os testes do motor e das regras não foram repetidos nesta revisão de apresentação; seus resultados anteriores permanecem registrados na seção E.
- Publicação real com `firebase deploy --only hosting --project gemini-9815a` concluída. Nenhuma alteração de plano ou faturamento nesta revisão.
- Validação no domínio publicado: catálogo, apresentação, recuperação da sala existente, controles e prévia de movimento. Viewports de 320, 375, 768 e 1280 px foram conferidas com medição das 49 células no DOM.
- Em 320 px, a largura útil e a largura do documento foram ambas 305 px; as casas mediram de 35,84375 a 35,859375 px em ambos os eixos. Em 375 px, as casas mediram de 42,5625 a 42,578125 px; em 768 px, de 56,84375 a 56,859375 px; em 1280 px, de 68,28125 a 68,296875 px. A diferença máxima de 0,015625 px corresponde à distribuição subpixel do navegador. As medidas de largura e altura são equivalentes e o documento não apresenta excesso horizontal nos quatro tamanhos.
- A consulta aos logs de erro do navegador retornou uma lista vazia durante essa validação. O ajuste temporário de viewport foi restaurado.
- Captura da arena publicada: [rastro-ui.png](rastro-ui.png).
- Consumo de tokens desta revisão: indisponível — o ambiente não forneceu dados verificáveis específicos para esta revisão.

## J. Partidas por pontos, duelos QTE e tutorial opcional

Revisão concluída em 9 de outubro de 2026; horário verificável consultado após o deploy final das regras: 11:55:27 BRT (14:55:27 UTC). Esta seção substitui as regras históricas de 16 rodadas descritas nas seções anteriores.

### Entrega

- Meta padrão de 15 pontos, editável de 5 a 100 pelo anfitrião na sala antes de iniciar. A revanche preserva essa meta. A partida não termina mais pelo contador de turnos; o contador interno permanece para identificar ações e expirar rastros.
- Seis cristais comuns e dois especiais, inicialmente distribuídos em pares simétricos. Reposição mantém essa quantidade enquanto houver casas legais disponíveis e a partida continuar.
- Colisões no mesmo destino, entrada na casa adversária e troca direta de posições abrem um duelo. Saltos que atravessam o adversário continuam válidos sem colisão, quando o destino está livre.
- QTE com preparação de 2 segundos e janela de 10 segundos por tentativa. O marcador usa `performance.now()` e `requestAnimationFrame`; a precisão considera a posição local no momento do toque, Espaço ou Enter, e não o tempo de chegada da mensagem pela rede.
- Quem parar mais perto do centro ganha. Se ambos acertarem a faixa, ou se houver empate de precisão, a etapa é repetida. O alvo alterna de lado, a duração do ciclo é multiplicada por 0,65 até um mínimo de 300 ms e a faixa diminui de 28% até um mínimo de 7%.
- Vitória no duelo dá 1 ponto e prioridade no movimento. O perdedor fica na origem; se essa casa for o destino ocupado do vencedor, ele recua para a origem do vencedor. Não há peças sobrepostas nem rastro criado sob uma peça deslocada. Um defensor parado que vence mantém sua posição.
- Tutorial em quatro popups. “Pular tutorial” inicia marcado, e só quem desmarcar verá o guia. O anfitrião optante conclui ou pula o guia antes do início; o convidado pode abri-lo na sala e, se ainda não tiver visto, vê-lo ao entrar na partida.
- Carta de salto com indicação de carga, sem controle deslizante. A seleção de salto é limpa após a jogada; tanto o serviço quanto o motor normalizam uma seleção antiga de salto consumido para movimento normal, evitando a rodada parada que era necessária para recuperar o controle.
- Ícone da aba em SVG com a letra `j`, mantendo o nome em texto no cabeçalho.

### Firebase e permissões

- Banco Standard `(default)` do projeto `gemini-9815a`, identificado novamente pela CLI antes da alteração do modelo. O Hosting e o plano gratuito foram mantidos; nenhum serviço pago ou faturamento foi ativado.
- Cada tentativa fica em `rooms/{codigo}/duels/{semente_turno_etapa}/attempts/{uid}`. Somente o dono pode criar a própria tentativa; ela é imutável. O adversário só pode ler depois das duas confirmações da mesma etapa.
- As regras validam tipos e limites da meta, tentativas, etapas e tamanhos das listas principais. O anfitrião só altera a meta no estado WAITING. Confirmar sem uma ação correspondente e gravar por caminhos de turno forjados são rejeitados.
- A resolução do QTE é transacional: repete a etapa ou aplica o vencedor uma vez, incrementando a versão e limpando as confirmações. As ações normais são bloqueadas enquanto há um duelo pendente.
- Limitação arquitetural preservada: o motor e a precisão rodam nos clientes dos participantes. As regras protegem identidade, privacidade e transições, mas não provam que uma posição enviada veio de um toque humano nem fornecem uma autoridade de jogo independente para impedir trapaças entre participantes. O modelo é adequado ao jogo entre pessoas de confiança; não é um serviço de competição com premiação.

### Validação

- 39 testes do motor aprovados. Incluem chegada à meta, ultrapassagem da meta por cristal especial, empate simultâneo, ausência de limite por 16 turnos, colisões, repetição dos dois acertos, alvo em novo local, aumento de velocidade, empate de precisão, timeout, salto consumido e movimento seguinte, 1.000 simulações e 5.000 sementes.
- 20 testes das regras e dos serviços da aplicação aprovados no Firestore Emulator. Incluem criar/entrar/configurar/iniciar, meta imutável após início, tentativas privadas, etapas QTE, imutabilidade, duplicação, propriedade forjada, terceiros, valores inválidos, caminho de turno forjado, confirmação sem ação, movimento depois do salto e revanche mantendo a meta.
- Oxlint sem avisos; build TypeScript/Vite aprovado. Aviso de tamanho do pacote multiplayer permanece (553,69 kB antes de gzip).
- O primeiro teste das regras encontrou o limite de 1.000 expressões durante a abertura do duelo. A escolha da validação foi organizada por estado e fase, evitando avaliar todos os caminhos de atualização; a suíte passou após essa correção.
- Deploy real de Hosting e Rules concluído. As Rules foram compiladas novamente pela CLI e publicadas após o último reforço de confirmação e caminhos de turno.
- Produção: sala de teste `VU8JY3`, anfitrião na interface e segunda identidade anônima independente em Node. Meta alterada para 25, checkbox inicialmente marcado, tutorial optante com os quatro popups, início somente após o guia, salto seguido imediatamente por movimento normal e oito cristais com dois especiais. Uma colisão abriu o QTE; o timeout do anfitrião foi resolvido em favor da outra identidade.
- Produção: sala de teste `WP6FEG`, meta padrão 15 e início sem tutorial. Movimentos das duas identidades causaram uma colisão; o anfitrião parou pela tecla Espaço dentro da faixa e a outra identidade enviou um acerto. A etapa avançou, o alvo mudou e a duração caiu de 2600 ms para 1690 ms. Etapas posteriores reportaram 1099 ms e 714 ms. Empates por timeout foram repetidos; um acerto posterior do anfitrião encerrou o duelo com 1 ponto, movimento ao destino disputado e retomada da partida.
- Após recarregar, a sala manteve a meta, o ponto, as posições e os cristais. Uma nova confirmação de movimento após o duelo foi aceita com as regras finais.
- A inspeção inicial da barra usou `parseFloat` dentro do escopo de leitura DOM, onde esse global não estava disponível; a inspeção foi corrigida para converter fora do escopo da página. Isso afetou uma tentativa automatizada de conferência, sem erro no aplicativo.
- Viewport de 320 px: largura útil e rolável do documento iguais a 305 px, sem excesso horizontal; 49 células com largura e altura entre 35,84375 e 35,859375 px. O tutorial mediu 277 px e coube na mesma viewport. Ajustes temporários de viewport foram restaurados.
- Consulta de logs de erro do aplicativo durante a validação retornou lista vazia. A segunda identidade foi um processo Node independente, e não um segundo aparelho físico.
- Capturas: [tutorial-ui.png](tutorial-ui.png) e [qte-ui.png](qte-ui.png). O estado final de uma sala de teste está em `qte-production-state.json`; o helper é `scripts/qte-production-check.mjs`. As salas de teste seguem a expiração lógica existente e não foram apagadas.
- Os processos auxiliares de convidado e emuladores foram encerrados após a conferência.
- Consumo de tokens desta revisão: indisponível — o ambiente não forneceu dados verificáveis específicos para esta revisão. Não foi registrada uma duração total porque não houve leitura do relógio no começo desta solicitação.

### Auditoria resumida do escopo

```json
{"score":3,"summary":"Permissões e privacidade do QTE verificadas por testes; o jogo mantém autoridade nos clientes participantes.","findings":[{"check":"Business Logic vs. Rules","severity":"moderate","issue":"Um participante modificado pode simular precisão de QTE e resultados de jogo; as regras não executam o motor determinístico.","recommendation":"Manter o uso entre participantes de confiança; uma competição adversarial exigiria autoridade independente para validar o jogo."}]}
```

## K. Duelo imediato somente por cristais — 09/10/2026

- Removida a preparação de dois segundos em todas as etapas do QTE. O relógio e o marcador iniciam antes da primeira pintura, com PARAR habilitado imediatamente. A janela de dez segundos permanece como limite para enviar a tentativa.
- Duelo ocorre somente quando ambos os movimentos são válidos e chegam ao mesmo cristal. Casa vazia, troca de posições e contato com a casa adversária apenas bloqueiam os movimentos conflitantes, sem pontuação, deslocamento do adversário ou consumo de salto.
- O vencedor coleta o cristal e recebe o bônus existente de um ponto. Um popup mostra a vitória e o placar; o perdedor recebe a indicação de quem ficou com o cristal. A mensagem também aparece quando a coleta encerra a partida. Controles de fundo ficam bloqueados enquanto o popup está aberto.
- Tutorial e apresentação atualizados para explicar a disputa por cristais.
- Testes: 41 do motor e três de interface passaram; 20 de regras e serviços multiplayer passaram no emulador. Lint e build concluídos. O primeiro build encontrou uma anotação de tipo ausente no mock de dialog; o ambiente jsdom também precisou de implementação de showModal/close. Ambos foram corrigidos antes da execução final. Permanece o aviso conhecido de tamanho do bundle Firebase.
- Navegador real conectado a Auth/Firestore locais: sala descartável 3KHFKW, anfitrião na interface e convidado independente em Node. Casa vazia manteve peças e pontuação, avançando o turno sem QTE. Na disputa por cristal, PARAR estava habilitado 271 ms após a confirmação, com o marcador já em 8,03%; esse intervalo inclui atualização de rede/renderização e chamadas da ferramenta, não uma contagem programada.
- Vitória normal mostrou dois pontos (cristal comum e bônus); Enter fechou o popup sem confirmar uma nova jogada. Outra fixture começou com 13 pontos e confirmou o popup de vitória com 15 pontos e botão para ver o resultado final. Logs de erro da página retornaram lista vazia.
- Capturas: duel-victory-ui.png e duel-final-victory-ui.png. Helper scripts/duel-local-check.mjs restrito ao projeto demo-juguitos e endpoints locais; somente fixtures locais foram alteradas para preparar esses cenários.
- Publicado com sucesso no Firebase Hosting do projeto gemini-9815a. Após recarregar a página pública, a apresentação mostrou duelos por cristais e os arquivos index-NdpGpjbW.js e index-DNe7SvA9.css da nova compilação. A conferência interativa dos cenários de duelo desta revisão ocorreu nos emuladores; a página e os arquivos publicados foram conferidos em produção.

## L. Salto sobre paredes e pessoas — 09/10/2026

- Salto especial de duas casas ignora os obstáculos na casa intermediária, incluindo paredes, rastros e o adversário. A aterrissagem continua respeitando paredes, rastros ativos, ocupação e disputa simultânea por cristal.
- Uma parede intermediária não impede o salto. A carga é consumida somente após um movimento bem-sucedido; o rastro é criado apenas na origem. Pular por cima de outra pessoa não abre duelo nem desloca sua peça.
- Tutorial, carta de salto, apresentação e README atualizados.
- Passaram 45 testes (42 do motor e três de interface), incluindo salto sobre parede, salto sobre pessoa e aterrissagem bloqueada sem consumo de carga. Lint e build concluídos. As regras Firestore não foram alteradas; a suíte de regras não foi reexecutada nesta revisão.
- Deploy do Hosting concluído no projeto gemini-9815a. A página pública, após recarregar, exibiu a descrição do salto sobre paredes e pessoas e carregou index-CTDNLbDm.js. Logs de erro vazios; captura jump-update-public.png. O comportamento do motor foi conferido pelos testes automatizados; não foi executada uma nova partida completa em produção nesta revisão.

## M. Textos do catálogo e tutorial no card — 09/10/2026

- Textos conforme pedido: JOGUITOS PARA DOIS; Vamos jogar alguma coisinha?; 100% joguitos!; bora escolher um joguito!; Feito por Lipeto ♥. Mantidas paleta, fontes, bordas, botões e ilustração do card.
- Removidos selo SÓ MAIS UMA?, contagem de participantes, PLAYER 1 + PLAYER 2 e opção Retomar sala do catálogo. Removida a gravação do marcador local que servia exclusivamente à opção de retomar; autenticação persistente e reconexão pelo link da sala permanecem funcionando.
- “Como jogar” no card do RASTRO abre os quatro popups existentes. Sala sem checkbox, visualização prévia ou abertura automática do tutorial. Iniciar salva a meta e começa diretamente.
- Campo de código com borda/foco roxos, seleção lilás e cursor roxo. O valor digitado é preservado durante a edição e normalizado ao enviar, evitando deslocamento do cursor provocado pela transformação imediata para maiúsculas. Ajuste aplicado também ao campo da apresentação do RASTRO.
- Passaram 48 testes. O primeiro teste de catálogo precisou corrigir o nome acessível dos botões, porque os ícones decorativos estão ocultos da acessibilidade. Após ajuste, todas as suítes locais passaram. Regras e motor do jogo sem alteração nesta revisão.
- Navegador local: tutorial percorrido pelas quatro etapas, retorno ao catálogo e edição no meio do código com cursor mantido na posição 2. Em viewport de 320 px, largura útil e rolável iguais a 305 px, sem excesso horizontal; popup com 277 px e margem de 14 px. Override de viewport restaurado.
- Lint e build concluídos; deploy do Hosting no projeto gemini-9815a concluído. Página pública recarregada, todos os textos e remoções conferidos, abertura do tutorial no card confirmada e index-RVxhkYdP.js carregado. Logs de erro vazios. Capturas catalog-public-update.png, catalog-public-tutorial.png, catalog-input-focus.png e catalog-tutorial-mobile.png. Servidor local encerrado após a conferência.

## N. Conta, Ovelha! — 09/11/2026

- Segundo jogo no catálogo, com tutorial de três telas, convite por link ou código começando pela letra O e revanche por consentimento dos dois. Ilustrações vetoriais e palco Canvas originais na mesma paleta do juguitos!. A pessoa adormece durante a preparação, as ovelhas atravessam o campo nos dois sentidos e a pessoa desperta para a revelação.
- As fases usam horário de servidor e sequência determinística de 8 a 36 ovelhas, de 9 a 5,4 segundos, com dificuldade crescente até a rodada 13. O jogo aceita palpites secretos de 0 a 99 por 12 segundos. A pessoa mais distante perde uma vida; empate preserva as vidas. Um palpite enviado vence um timeout; dois timeouts preservam as vidas e pedem ação para continuar. O jogo termina ao zerar uma das duas contagens.
- O áudio é sintetizado via Web Audio: trilha original, balidos, confirmação e resultado. A trilha vai de 106 a 214 BPM com a dificuldade, e pode ser ativada ou silenciada independentemente em cada navegador.
- Firebase Standard existente; sem novo serviço, dependência ou faturamento. As regras validam convite, associação, horário, palpite imutável e perda de vida calculada a partir dos valores registrados. Escritas usam transações; solicitações concorrentes observadas no emulador foram resolvidas sem perda adicional de vidas.
- Validação automatizada: 52 testes de aplicação e 24 de Firestore passaram; lint e build passaram. A suíte de segurança recusou consulta da coleção, leitura sem autenticação ou por terceiro em sala fechada, escrita com UID alheio, alteração de dono ou palpite, remoção de campo obrigatório, campo extra grande, tipo inválido, abertura antes do anfitrião/segunda vaga, palpite sem confirmação atômica, confirmação sem palpite, leitura prematura, avanço antes da hora, resultado inventado e alteração do relógio. Validou perda por timeout e revanche. O compilador remoto emitiu dois avisos de análise estática sobre valores nulos; a compilação e os testes de timeout passaram.
- Navegador no emulador: dois logins distintos, três rodadas completas, tempos comparados com diferença de cerca de 23 ms na amostra da barra, BPM 106/115/124, zero vidas seguido de revanche com três vidas. Na área de 320 px, o palco mediu 290 px e a página não teve rolagem horizontal. Capturas conta-ovelha-rodada.png, conta-ovelha-vitoria.png e conta-ovelha-celular.png.
- Produção: Firestore Rules e Hosting publicados no projeto gemini-9815a. Sala descartável criada em web.app e acessada por segunda identidade em firebaseapp.com. Os dois navegaram pela mesma rodada e viram 12 ovelhas no resultado; palpites 10 e 99 deixaram as vidas em 3 e 2. O som foi ativado sem erro de navegador. Captura conta-ovelha-publicado.png. O percurso completo até zero e revanche foi feito no emulador, e a primeira rodada foi repetida em produção.
- Escopo da proteção: as regras foram verificadas nos cenários acima. O jogo é casual; o navegador precisa da sequência para desenhar as ovelhas e essa informação permite calcular a resposta fora da interface.

## O. Conta, Ovelha! — progressão e ovelhas que caem — 14/11/2026

- Rebanhos da versão 3 variam de 8 a 19 ovelhas. A contagem e os movimentos começam a aumentar na rodada 2; a cada cinco ovelhas, aproximadamente uma cai do céu a partir da rodada 3, quica no chão e corre até sair por uma das laterais.
- O impacto tem poeira, aro e um efeito sonoro sincronizado. A sequência permanece determinística nos dois navegadores; as regras do Firestore calculam a nova contagem ao validar o resultado.
- Salas antigas mantêm a versão de rebanho em que começaram. Build concluído; regras Firestore compiladas e publicadas junto com o Hosting em `gemini-9815a`.

## P. Conta, Ovelha! — escalada contínua — 15/11/2026

- Salas novas usam a versão 4: quantidade de ovelhas cresce duas por rodada, com variação determinística adicional, e a velocidade das travessias aumenta em cada rodada. O BPM sobe 9 a cada rodada sem limite fixo.
- A 7ª rodada tem 22–31 ovelhas; a 10ª, 28–37. As ovelhas que caem também aceleram em sincronia com o rebanho. Versões 1 a 3 continuam disponíveis para salas já criadas.
- A regra Firestore valida a mesma contagem usada pelo motor do jogo. O teste existente foi ajustado para refletir o BPM sem teto; build concluído e publicação de Hosting e regras no projeto `gemini-9815a`.
