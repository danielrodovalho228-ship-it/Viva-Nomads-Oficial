# Varredura de erros — rodada 28 (06/11/2026)

Mesma família das rodadas 21–27: a falha de leitura do banco não pode virar "não encontrado" ou "vazio" calado.

## Achados
- **139 — detalhe da proposta** (`propostas-actions.ts`, `lerProposta`): a falha ao ler a proposta ou as versões virava `null`, e a página dava 404. O interessado ou o dono achava que a proposta tinha sumido. Agora a falha lança (tela de erro com código e "Tentar de novo"). O 404 fica só para quem não é parte (a RLS devolve vazio, sem erro) e para o id inexistente.
- **140 — responder à proposta** (`carregarParaResponder`): com a leitura falhando, aceitar, recusar ou contrapor dizia "Proposta não encontrada." Agora diz "Não foi possível carregar a proposta agora. Tente de novo."

## Fora desta rodada (de propósito)
- `contarPropostasAguardando` (contador do menu): já é chamado com `.catch(() => 0)` — é o best-effort do menu, não uma tela de decisão.
- `getAlertasEquipe` e `getRespostasRecebidas` (pedidos): leituras de apoio, sem decisão em cima.

## Teste
`src/lib/data/achado139-140-proposta-leitura.test.ts` (3 casos, escritos antes e vistos vermelhos).
