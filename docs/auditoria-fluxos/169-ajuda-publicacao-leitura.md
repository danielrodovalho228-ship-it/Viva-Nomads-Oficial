# Achado 169 — ajuda para publicar: falha de leitura do pedido virava "Pedido não encontrado"

**Fluxo:** equipe mudando a etapa do pedido e dono aprovando/pedindo ajuste do rascunho (`src/lib/data/ajuda-publicacao-actions.ts`).
**Defeito:** duas leituras sem olhar o `error`; com o banco falhando a pessoa lia "Pedido não encontrado." e achava que o pedido sumiu.
**Correção:** cada leitura destrincha o erro e diz "Não foi possível ler o pedido agora. Tente de novo." antes da frase de "não encontrado".
**Teste:** `src/lib/data/achado169-ajuda-publicacao-leitura.test.ts`.
