# E651 — a recusa do CPF no cadastro de parceiro disparava só no servidor

**Defeito:** em `seja-parceiro-form.tsx`, `enviar()` mandava a pessoa deslogada para `/auth` (`irParaConta()`) ANTES de
chamar `validarSolicitacao`. Digitar um CPF no campo do documento avançava para a criação de conta sem nenhuma recusa;
o servidor (que já recusava o CPF desde o E648) só era alcançado depois do retorno do login.

**Correção:**
- `validarDocumentoParceiro` (regras.ts): CPF (11 dígitos, válido ou não) → `MSG_SO_CNPJ`; menos/mais de 14 dígitos →
  "Informe o CNPJ com 14 dígitos"; dígito verificador errado → "CNPJ inválido"; senão `null`.
- O formulário confere o documento no passo, antes de `irParaConta()`; a recusa aparece em `seja-parceiro-erro`.
- `validarSolicitacao` (servidor) usa a mesma função: um critério só, nas duas pontas.

**Testes:** `e651-recusa-documento.test.ts` (5; vermelho antes, por falta da função). Specs de laboratório: t236 ganha o
caso "CPF deslogado não avança"; t236 e t44 passam a preencher um CNPJ válido antes de seguir ao `/auth` (antes iam com o
documento em branco). Escopo: `node --test src/lib/parceiros/*.test.ts` 163/163; `tsc` limpo.

**Dependência:** a prova de fechamento do E648 usa este caminho (CPF no formulário público).
