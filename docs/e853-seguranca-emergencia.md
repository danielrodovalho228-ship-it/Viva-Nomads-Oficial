# E853 🔴 — /seguranca volta a ter a linha de emergência

**Defeito (confirmado duas vezes):** /seguranca não dizia o que fazer numa emergência. A frase só existia no chat de atendimento.

**Correção:**
- A frase aprovada fica em `FRASE_EMERGENCIA_SEGURANCA` (`src/lib/seguranca/emergencia.ts`): "Em uma emergência, ligue 190 ou 193. A Viva não recebe esse tipo de ligação."
- Aparece em destaque logo no início do conteúdo, antes dos golpes: caixa vermelha clara com ícone de alerta, `role="note"`, `data-testid="seguranca-emergencia"`.
- Os números 190 e 193 são links `tel:`, que ligam com um toque no celular. O texto não muda.

**Teste:** `src/lib/seguranca/e853-emergencia.test.ts`, vermelho na main e verde na branch.
