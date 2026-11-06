# Varredura de erros — rodada 27 (06/11/2026)

Mesma família das rodadas 21–26: a falha de leitura do banco não pode virar "vazio" calado. Padrão da casa: com `exigir`
(a tela da lista), a falha lança e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo"; quem não pede
`exigir` (contadores, home, menus) segue best-effort.

## Achados
- **136 — visitas do morador** (`visitas-video-actions.ts`, `listMinhasVisitas`): a falha ao ler o imóvel da visita confirmada fazia sumir o endereço, sem aviso (a tela não explica a ausência).
- **137 — visitas do dono** (`listVisitasDono`): mesma leitura do imóvel (endereço e região).
- **138 — respostas prontas** (`atendimento-actions.ts`, `listarMacros`): a falha virava "nenhuma resposta pronta"; o admin recriaria macros que já existem. A aba pede com `exigir`; a conversa do chamado segue best-effort.

## Fora desta rodada (de propósito)
- Leituras de nome (`profiles`) e de selos de identidade nos mesmos cartões: a falha cai no padrão protegido ("Interessado(a)", sem selo), que não engana o dono.
- Leitura de pedidos ignorados em `getPedidosParaProprietario`: a falha só reexibe um pedido que o dono já dispensou.

## Teste
`src/lib/data/achado136-138-visitas-macros.test.ts` (4 casos, escritos antes e vistos vermelhos).
