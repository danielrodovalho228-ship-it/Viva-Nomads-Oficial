# Achado 174 — estadia: falha de leitura virava "Proposta/Contrato não encontrado"

**Fluxo:** abrir a proposta de aditivo (aceitar, recusar, retirar) e salvar as instruções de chegada de um contrato (`src/lib/data/estadia-actions.ts`).
**Defeito:** duas leituras sem olhar o `error`; com o banco falhando a pessoa lia "Proposta não encontrada." / "Contrato não encontrado.".
**Correção:** cada leitura destrincha o erro: "Não foi possível ler a proposta/o contrato agora. Tente de novo."
**Teste:** `src/lib/data/achado174-estadia-leitura.test.ts`.
