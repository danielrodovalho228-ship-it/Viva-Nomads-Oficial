# Achado 171 — pedido de serviço e reclassificação de manutenção: falha de leitura virava "não encontrado"

**Fluxo:** admin mudando o estado de um pedido de serviço (`servicos-morador-actions.ts`) e reclassificando a prioridade de uma solicitação (`manutencao-actions.ts`).
**Defeito:** duas leituras sem olhar o `error`; com o banco falhando lia "Pedido não encontrado." / "Solicitação não encontrada.".
**Correção:** cada leitura destrincha o erro: "Não foi possível ler o pedido/a solicitação agora. Tente de novo."
**Teste:** `src/lib/data/achado171-servicos-reclassificar-leitura.test.ts`.
