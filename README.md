# juguitos!

Minijogos roxos para duas pessoas jogarem juntas pelo navegador. Crie uma sala e mande o convite. O jogo cria uma identidade anônima para cada jogador.

**[Jogar no GitHub Pages](https://lipe-to.github.io/juguitos/)** · [Abrir no Firebase Hosting](https://gemini-9815a.web.app/)

## Escolha um jogo

| Jogo | Como funciona |
| --- | --- |
| **RASTRO** | Planeje seu passo em segredo, colete cristais e chegue à meta antes do rival. Se os dois disputarem o mesmo cristal, um duelo de precisão decide quem fica com ele. |
| **Conta, Ovelha!** | Conte cada ovelha quando ela entra no campo e envie seu palpite. Quem erra mais perde uma vida. O rebanho acelera conforme a partida avança. |
| **Campo Minado x1** | Aguarde seu rival na sala e largue junto. Em dois minutos, atravesse mais campos que ele; use pistas e bandeiras para escolher cada passo. Uma explosão custa cinco segundos. Se houver empate, vence a próxima travessia. |

O catálogo tem um tutorial para cada jogo e um campo para entrar pelo código. No Campo Minado, a sala mostra as duas vagas: o anfitrião inicia quando ambas estiverem ocupadas e uma contagem regressiva sincroniza a largada. Para testar no mesmo aparelho, abra o convite em outro perfil ou janela anônima.

As três telas de entrada seguem a mesma hierarquia, usam a identidade roxa do catálogo e mantêm arte e instruções próprias de cada jogo. A navegação de retorno usa apenas o ícone de seta, com rótulo acessível.

### Campo Minado x1

- **Largada:** cada mapa começa com uma área de casas seguras conectadas na borda inferior. A primeira jogada é destacada e validada pelo servidor; ela sempre é segura. Se revelar um zero, as casas seguras ligadas a zeros se abrem em cadeia.
- **Passos e pistas:** abra casas com contorno para avançar para uma vizinha pelo lado. Os números contam minas nas oito casas ao redor, inclusive diagonais. Abrir uma casa segura na linha de cima completa o mapa.
- **Bandeiras:** botão direito marca ou desmarca uma casa fechada. Em telas touch, use **Modo bandeira**; no teclado, foque uma casa e pressione **F**. O clique normal abre somente casas alcançáveis.
- **Retomada:** a identidade anônima fica no armazenamento local do navegador. Recarregar a mesma sala recupera sua vaga, mapa, bandeiras e tempo de bloqueio; use o mesmo navegador para manter essa identidade.
- **Acessibilidade:** cada casa informa linha, coluna e estado para leitores de tela; a área do mapa pode ser rolada nos dois sentidos. A chegada, as casas seguras, minas e estados também têm contornos, ícones e rótulos.

## Rodar localmente

Use Node.js 24 e pnpm 11.25.0, as versões da publicação no GitHub. O emulador do Firestore também precisa de um Java compatível com o Firebase CLI.

```sh
pnpm install
pnpm dev
```

- **RASTRO e Conta, Ovelha!** Copie `.env.example` para `.env.local` e preencha a configuração pública de um app Firebase com Auth anônima habilitada. Para rodar com emuladores, use `VITE_FIREBASE_PROJECT_ID=demo-juguitos`, `VITE_FIREBASE_USE_EMULATORS=true` e valores de teste para as outras chaves. Execute `pnpm emulators` em outro terminal.
- **Campo Minado x1** Execute `pnpm minas:dev` em outro terminal. O Vite usa o Worker local na porta 8787 por padrão. `VITE_MINES_API_URL` pode apontar para outra instância.

| Comando | O que verifica |
| --- | --- |
| `pnpm lint` | Lint do frontend |
| `pnpm test` | Motores dos jogos, interfaces e catálogo |
| `pnpm build` | Tipos e build de produção |
| `pnpm test:rules` | Regras do Firestore com Auth e Firestore emulados |
| `pnpm test:minas:online` | Sala de espera, largada explícita, primeira jogada segura, bandeiras, isolamento, reconexão e jogadas duplicadas no Worker local |

## Publicação

O **GitHub Pages** hospeda o frontend estático. O fluxo [pages.yml](.github/workflows/pages.yml) usa o subcaminho fornecido pelo Pages e roteamento por hash, de modo que um convite funcione ao abrir uma nova aba ou recarregar a página. Para publicar um fork, selecione **GitHub Actions** em **Settings → Pages** e configure as variáveis públicas `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` e `VITE_MINES_API_URL` em **Settings → Secrets and variables → Actions → Variables**. Adicione a origem do seu Pages às origens aceitas pelo Worker.

O **Firebase Spark** fornece Auth anônima e Firestore para os dois primeiros jogos. Também serve a versão com URLs sem hash no Firebase Hosting. O **Cloudflare Workers Free** executa o servidor do Campo Minado. Cada sala usa um Durable Object com SQLite para guardar a semente, validar as jogadas e aplicar o relógio. As salas do Campo Minado expiram após 24 horas.

O fluxo do Pages publica a interface. Regras Firestore e mudanças no Worker têm publicações próprias. Veja as instruções e convenções em [AGENTS.md](AGENTS.md).
