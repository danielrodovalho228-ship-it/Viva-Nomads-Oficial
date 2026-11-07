# Achado 173 — pedido do parceiro: falha de leitura virava "Pedido/Arquivo não encontrado"

**Fluxo:** cliente e parceiro agindo no pedido (aceitar, recusar, cancelar, concluir, avaliar) e baixando o arquivo entregue (`src/lib/parceiros/pedido-actions.ts`).
**Defeito:** `carregar` (porta de todas as ações do pedido) e a leitura da entrega não olhavam o `error`; com o banco falhando a pessoa lia "Pedido não encontrado." / "Arquivo não encontrado.".
**Correção:** as duas leituras destrincham o erro e dizem "Não foi possível ler o pedido agora." / "…abrir o arquivo agora. Tente de novo." O "não encontrado" de quem não é parte continua igual (não revela que o pedido existe).
**Teste:** `src/lib/parceiros/achado173-pedido-leitura.test.ts`.
