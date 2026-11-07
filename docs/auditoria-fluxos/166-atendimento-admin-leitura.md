# Achado 166 — atendimento (admin): falha de leitura do chamado virava "Chamado não encontrado"

**Fluxo:** atendente respondendo ao chamado, mudando prioridade/estado, corrigindo a resposta da IA e pedindo o rascunho por regra (`src/lib/data/atendimento-actions.ts`).
**Defeito:** quatro leituras sem olhar o `error`: "Chamado não encontrado." / "Resposta não encontrada." com o banco falhando; o atendente podia achar que o chamado do cliente tinha sumido.
**Correção:** cada leitura destrincha o erro e diz "Não foi possível ler o chamado/a resposta agora. Tente de novo." antes da frase de "não encontrado".
**Teste:** `src/lib/data/achado166-atendimento-admin-leitura.test.ts`.
