# E721 — "Adiar" a conversa em /dashboard/mensagens (reprovado em 10/11)

**Diagnóstico (a):** o "adiar" do E721 original era o **adiamento do push** no servidor (`push_adiados`, silêncio 22h–7h): o erro `[push] adiar 42P10` vinha de `processarPush` (índice parcial da 0226, corrigido pela 0332/PR #3466). **Nunca existiu uma ação "Adiar" na tela de Mensagens** — nem foi removida: `git log -S"Adiar"` em `src` não acha nenhuma. Por isso a QA achou 0 ocorrências, e o 42P10 não se reproduz (não há o que clicar). A correção anterior estava certa para o push; faltava entregar a ação da pessoa.

**Entrega (b):**
- Migração **0336** `public.conversas_adiadas (user_id, conversation_id, adiada_em, ate)`, PK `(user_id, conversation_id)` — chave única completa, então o upsert não tem o problema do 42P10. RLS: só as próprias linhas; inserir só de conversa de que é parte. Nenhuma mensagem é tocada. `aplicar-0336.sql` idempotente + rollback.
- `src/lib/data/conversa-adiar-actions.ts`: `adiarConversa(id, "1d"|"3d"|"7d")` e `retomarConversa(id)`.
- `listConversations` lê o estado; regra pura em `src/lib/mensagens-filtros.ts` (`estaAdiada`, `separarAdiadas`, `PRAZOS_ADIAR`).
- Tela: botão **Adiar** sempre visível no cabeçalho da conversa aberta (menu: 1 dia, 3 dias, 1 semana); a adiada sai de "Todas" e dos chips de papel e aparece no chip **Adiadas** (surge quando há alguma), com o botão **Retomar** e o aviso "Adiada até dd/mm…".
- **Dois lados:** cada pessoa adia a sua visão (morador e proprietário independentes); a outra parte não é avisada. A conversa volta sozinha quando o prazo acaba **ou** quando a outra parte escreve depois de adiar.

**Prova (c):** `src/lib/mensagens/e721-adiar-conversa.test.ts` (7 testes: prazos, regra de adiada/volta, separação por chip, migração/RLS/aplicar/rollback, servidor sem 42P10, ligação da tela e da leitura). Ponta a ponta no navegador é da QA depois que a Action aplicar a 0336; não fiz prova ao vivo.
