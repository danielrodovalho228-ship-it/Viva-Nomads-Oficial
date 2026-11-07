# Achado 170 — cartões de compartilhar: falha de leitura virava "Imóvel/Contrato não encontrado"

**Fluxo:** dono gerando o cartão do anúncio e morador gerando o cartão-postal (`src/lib/data/cartoes-actions.ts`).
**Defeito:** duas leituras sem olhar o `error`; com o banco falhando a pessoa lia "não encontrado".
**Correção:** cada leitura destrincha o erro: "Não foi possível ler o imóvel/contrato agora. Tente de novo."
**Teste:** `src/lib/data/achado170-cartoes-leitura.test.ts`.
