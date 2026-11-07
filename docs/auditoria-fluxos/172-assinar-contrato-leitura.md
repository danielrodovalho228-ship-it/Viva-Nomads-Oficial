# Achado 172 — assinar o contrato: falha de leitura virava "Contrato não encontrado"

**Fluxo:** morador ou dono assinando o contrato (`src/lib/data/contrato-assinar-actions.ts`, `assinarContrato`).
**Defeito:** a leitura do contrato não olhava o `error`; com o banco falhando a pessoa lia "Contrato não encontrado." na hora de assinar.
**Correção:** destrincha o erro: "Não foi possível ler o contrato agora. Tente de novo." antes da frase de "não encontrado".
**Teste:** `src/lib/data/achado172-assinar-contrato-leitura.test.ts`.
