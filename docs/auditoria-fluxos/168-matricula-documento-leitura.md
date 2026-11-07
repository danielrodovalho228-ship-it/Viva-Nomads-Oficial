# Achado 168 — admin: matrícula e reenvio de documento fiscal: falha de leitura virava "não encontrada"

**Fluxo:** admin decidindo a matrícula do imóvel (`src/lib/data/matriculas-admin.ts`); reenvio de documento fiscal (`src/lib/fiscal/emitir.ts`).
**Defeito:** as leituras não olhavam o `error`: "Matrícula não encontrada." / "documento não encontrado" com o banco falhando.
**Correção:** cada leitura destrincha o erro e diz "Não foi possível ler a matrícula agora. Tente de novo." / "falha ao ler o documento" antes da frase de "não encontrado".
**Teste:** `src/lib/data/achado168-matricula-documento-leitura.test.ts`.
