# E781 — abas do anúncio no celular (09/11/2026)

- **Reprodução (Chromium 390 px, toque, anúncio de exemplo ube-003, servidor local):** o salto nativo funcionou nas cinco abas (seção a 144 px do topo, aba ativa certa). Não reproduzi o print do Daniel (aba "Localização" marcada com a visão geral na tela): a falha acontece no aparelho dele (iOS/Safari ou página ainda carregando).
- **Causa provável (código):** `nav-secoes.tsx` marcava a aba no toque e deixava a rolagem a cargo do salto nativo do `#hash`, que no celular pode não sair do lugar ou parar antes quando a página muda de altura ao carregar. Marca ≠ posição.
- **Correção:** o toque rola por código até a seção com a compensação das abas presas (base das abas + 8 px), grava o `#hash` e confere a posição 4 vezes em 1,4 s (corrige o empurrão do carregamento). A aba ativa continua seguindo a rolagem.
- **Prova local (390 px, ube-003):** as 5 abas deixam a seção a 127 px do topo, logo abaixo das abas, e a aba ativa é a tocada; capturas de 3 abas em `docs/capturas/e781/`.
- **Anúncio real:** sem acesso a anúncio real no ambiente local; o QA do chat principal confere no aparelho do Daniel.
