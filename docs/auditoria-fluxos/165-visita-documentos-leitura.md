# Achado 165 — visita por vídeo e documentos com falha: falha de leitura virava "não encontrado"

**Fluxo:** dono/morador respondendo a um pedido de visita (aceitar, recusar, remarcar, cancelar) em `src/lib/data/visitas-video-actions.ts`; admin emitindo de novo um documento com falha em `src/lib/data/documentos-falhas-actions.ts`.
**Defeito:** as duas leituras não olhavam o `error`: "Pedido não encontrado." / "Item não encontrado." com o banco falhando.
**Correção:** cada leitura destrincha o erro e diz "Não foi possível ler … agora. Tente de novo." antes da frase de "não encontrado".
**Teste:** `src/lib/data/achado165-visita-documentos-leitura.test.ts` (as expressões só casam com o texto novo).
