# juguitos!

## Escopo e custos

- O juguitos! reúne minijogos originais para duas pessoas, em português do Brasil. O fluxo comum passa pelo catálogo, tutorial curto, criação ou entrada em sala, partida e resultado.
- Priorize serviços gratuitos que interrompam operações ao esgotar a cota. Peça autorização explícita antes de habilitar faturamento, contratar serviços ou usar recursos que cobrem por excedente.
- O frontend usa React, TypeScript, Vite e React Router. O GitHub Pages e o Firebase Hosting servem os arquivos estáticos. RASTRO e Conta, Ovelha! usam Firebase Spark. Campo Minado x1 usa Cloudflare Workers Free com Durable Objects SQLite.

## Mapa do código

| Caminho | Responsabilidade |
| --- | --- |
| `src/App.tsx` e `src/main.tsx` | Rotas e escolha do roteador. O modo Vite `pages` usa HashRouter e o build padrão usa BrowserRouter. |
| `src/games/registry.ts` e `src/catalog/` | Metadados dos jogos, cards, tutoriais e despacho por código de convite. |
| `src/layout/SiteHeader.tsx` e `src/style.css` | Cabeçalho, marca, botões, tokens visuais e layout compartilhado. |
| `src/games/rastro/` e `src/games/ovelhas/` | Motores, interface e adaptação para o Firestore de cada jogo. |
| `src/firebase/` e `firestore.rules` | Configuração, sessão anônima, acesso aos estados de jogo e testes de regras. |
| `src/games/minas/` e `worker/` | Interface e API do Campo Minado, motor determinístico e estado persistido por sala. |
| `.github/workflows/pages.yml`, `firebase.json` e `worker/cloudflare.config.ts` | Publicação do Pages, configuração do Firebase e configuração do Worker. |

## Regras dos jogos

- **RASTRO** tem tabuleiro 7 × 7, meta padrão de 15 pontos e intervalo de 5 a 100 para o anfitrião. As ações são simultâneas e ocultas até as confirmações. Cada jogador tem um salto por partida. Disputa pelo mesmo cristal aciona o duelo. Preserve o sigilo das ações e a resolução atômica.
- **Conta, Ovelha!** começa com três vidas por jogador. O mesmo rebanho determinístico aparece para os dois. Após a exibição, cada pessoa tem 12 segundos para enviar um palpite de 0 a 99. Perde uma vida quem se afasta mais da contagem ou fica sem responder quando o rival responde. Empates preservam as vidas. A dificuldade aumenta ao longo das rodadas.
- **Campo Minado x1** tem 120 segundos, campos a partir de 4 × 6 e crescimento de 1 coluna e 2 linhas a cada travessia. A sala permanece em espera até o anfitrião iniciar com duas pessoas presentes; a contagem regressiva de 3 segundos e os 120 segundos de corrida vêm do servidor. A largada abre `round(total / 12)` casas conectadas na base, com pelo menos um zero e uma saída segura. A primeira casa segura destacada é obrigatória e aceita uma vez. Abrir um zero revela a área segura conectada. O passo abre uma vizinha pelo lado e a pista conta as oito vizinhas. Botão direito, Modo bandeira e tecla `F` marcam ou desmarcam casas fechadas; bandeiras impedem que essa casa seja aberta. A primeira casa segura no topo completa o campo. A explosão restaura a largada e bloqueia o jogador por cinco segundos. Se o tempo acabar empatado, a primeira travessia aceita pelo servidor vence. A semente, progresso e bandeiras individuais ficam no Durable Object. Preserve a deduplicação por revisão e a reconexão no mesmo navegador.

## Padrão visual

- Use a paleta roxa do site com os tokens `--purple`, `--deep`, `--lilac`, `--paper` e `--ink`. A tipografia atual usa Fredoka nos títulos e DM Sans no restante.
- Reaproveite `Header`, `page-shell`, botões e cards. Reserve cores de alerta para estados como explosão ou erro. Use texto, ícones ou contornos junto da cor para sinalizar estados.
- Teste teclado, foco visível, alvos de toque e larguras de celular. Dê a ações e células rótulos acessíveis. Mantenha placar, tempo e feedback da jogada legíveis.
- Use texto curto em português. Sons devem respeitar as restrições de reprodução do navegador e o controle de silenciar quando o jogo tiver áudio.
- No Campo Minado, conserve a identidade roxa do site, apresente vagas numeradas e estado de conexão na sala de espera, deixe apenas o anfitrião iniciar e mostre claramente countdown, bloqueio, corrida, prorrogação e resultado. Mantenha os controles touch e de teclado junto do botão direito; não dependa apenas de cor para mostrar células ou pontuação.

## Adicionar um jogo

1. Crie `src/games/<id>/` com o motor separado da interface. Defina a fonte de verdade para pontuação, prazos e ações simultâneas.
2. Cadastre o jogo em `src/games/registry.ts`. Adicione card e tutorial ao catálogo e rotas de introdução e sala em `src/App.tsx`. Use carregamento sob demanda quando fizer sentido.
3. Se o jogo usar códigos, reserve um prefixo que o gerador dos jogos existentes não use e registre o roteamento no catálogo. Ovelhas usa `O`, Campo Minado usa `I` e o restante do alfabeto atual vai para RASTRO. Gere convites com o roteador para respeitar o subcaminho e o hash do Pages.
4. Reaproveite o Firebase anônimo e as transações se o jogo se encaixar nesse modelo. Quando o servidor precisar guardar mapas ou respostas em segredo, valide os movimentos em um Worker e devolva somente o estado visível para a pessoa. Cuide de concorrência, repetição de pedidos e reconexão.
5. Exercite cadastro no catálogo, tutorial, convite, partida com duas identidades, recarga e desfecho. Inclua o diretório na rotina de testes quando adicionar testes automatizados ao jogo.

## Desenvolvimento e publicação

- Use Node.js 24 e pnpm 11.25.0. Rode `pnpm install` e `pnpm dev`. Para multiplayer local, inicie `pnpm emulators` para os jogos Firebase e `pnpm minas:dev` para Campo Minado. Use perfis de navegador separados.
- Antes de publicar, rode `pnpm lint`, `pnpm test` e `pnpm build`. Mudanças de regras pedem `pnpm test:rules` com emuladores. Mudanças na API do Campo Minado pedem `pnpm test:minas:online` com o Worker local.
- Para considerar o Campo Minado pronto, confira: sala mostra anfitrião e vaga do rival; convidado entra sem disparar a partida; só o anfitrião pode iniciar com duas pessoas; a contagem regressiva sincroniza; a primeira casa destacada é segura e abre uma vez; zero revela a área segura; clique direito, modo touch e tecla `F` marcam casas; abrir bandeira não avança; chegada, explosão, bloqueio de 5 segundos, reconexão, prorrogação e placar continuam corretos em duas identidades. Verifique desktop e celular, inclusive rolagem vertical e horizontal.
- O Pages roda a partir de `main` e recebe as configurações públicas via variáveis do repositório. O Worker deve permitir explicitamente a origem do frontend em `worker/index.js`.
- Para atualizar Firebase Hosting, use o build padrão e `pnpm exec firebase deploy --only hosting --project gemini-9815a` quando solicitado. Publique regras separadamente depois de validá-las. Para publicar o servidor de Campo Minado, use `pnpm minas:deploy` na conta Cloudflare Free autorizada.
- Guarde configurações locais em `.env.local`. Variáveis Vite ficam visíveis no navegador. Credenciais AWS, Firebase Admin, GitHub, Cloudflare e tokens de sala devem ficar fora de código, commits e logs.
