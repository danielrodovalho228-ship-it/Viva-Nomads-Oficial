# E721 — "Adiar" a conversa em /dashboard/mensagens (reprovado em 10/11)

**Diagnóstico (a):** o "adiar" do E721 original era o **adiamento do push** no servidor (`push_adiados`, silêncio 22h–7h): o erro `[push] adiar 42P10` vinha de `processarPush` (índice parcial da 0226, corrigido pela 0332/PR #3466). **Nunca existiu uma ação "Adiar" na tela de Mensagens** — nem foi removida: `git log -S"Adiar"` em `src` não acha nenhuma. Por isso a QA achou 0 ocorrências, e o 42P10 não se reproduz (não há o que clicar). A correção anterior estava certa para o push; faltava entregar a ação da pessoa.

**Entrega (b):**
- Migração **0336** `public.conversas_adiadas (user_id, conversation_id, adiada_em, ate)`, PK `(user_id, conversation_id)` — chave única completa, então o upsert não tem o problema do 42P10. RLS: só as próprias linhas; inserir só de conversa de que é parte. Nenhuma mensagem é tocada. `aplicar-0336.sql` idempotente + rollback.
- `src/lib/data/conversa-adiar-actions.ts`: `adiarConversa(id, "1d"|"3d"|"7d")` e `retomarConversa(id)`.
- `listConversations` lê o estado; regra pura em `src/lib/mensagens-filtros.ts` (`estaAdiada`, `separarAdiadas`, `PRAZOS_ADIAR`).
- Tela: botão **Adiar** sempre visível no cabeçalho da conversa aberta (menu: 1 dia, 3 dias, 1 semana); a adiada sai de "Todas" e dos chips de papel e aparece no chip **Adiadas** (surge quando há alguma), com o botão **Retomar** e o aviso "Adiada até dd/mm…".
- **Dois lados:** cada pessoa adia a sua visão (morador e proprietário independentes); a outra parte não é avisada. A conversa volta sozinha quando o prazo acaba **ou** quando a outra parte escreve depois de adiar.

**Prova (c):** `src/lib/mensagens/e721-adiar-conversa.test.ts` (7 testes: prazos, regra de adiada/volta, separação por chip, migração/RLS/aplicar/rollback, servidor sem 42P10, ligação da tela e da leitura). Ponta a ponta no navegador é da QA depois que a Action aplicar a 0336; não fiz prova ao vivo.

## Devolução do QA (rodada 11:50 de 10/11) e correção (11/11)
**Veredito:** "permissão de coluna da 0336 barra o upsert". A 0336 concede `grant update (adiada_em, ate)`; o `upsert` do supabase-js vira `INSERT … ON CONFLICT (user_id, conversation_id) DO UPDATE SET` com **as 4 colunas**, e o Postgres exige UPDATE em todas as colunas do SET → `permission denied for table conversas_adiadas`. Os testes antigos eram só estáticos e não pegavam isso; o `lab-critico` não tinha spec do fluxo.

**Correção (só na ação, o grant continua estreito):** `adiarConversa` faz `UPDATE` só de `adiada_em, ate` com `eq(user_id) eq(conversation_id)`; sem linha afetada (primeira vez), `INSERT` (a policy de insert exige ser parte da conversa); se outro pedido inseriu no meio (`23505`), atualiza de novo. `retomarConversa` segue com `DELETE` (sem linha, sem erro). Nenhuma mudança na 0336.

**Prova no Postgres 16 real (local, papéis + RLS + a 0336 aplicada; scripts em `docs/e721-prova-postgres/`):**
- `1-upsert-antigo-falha.sql` (o caminho do PR antes): `ERROR: permission denied for table conversas_adiadas` — o defeito do QA reproduzido.
- `2-caminho-novo.sql`: (1) adiar → update 0 linhas, insert 1 · (2) adiar de novo → update 1 (ate 7 dias) · (3) retomar → delete 1 · (4) retomar de novo → delete 0, **sem erro** · (5) o outro lado adia a própria visão: cada lado vê só a sua linha (1 × 0) · (6) RLS recusa adiar conversa de que não é parte (`violates row-level security policy`) e mudar o dono da linha (`permission denied`).

**Prova no caminho real do app (laboratório):** `tests/e2e/specs/t1600-e721-adiar-conversa.spec.ts` — pela tela, com Supabase/PostgREST/RLS do lab: adiar (insert), adiar de novo com linha vencida (update), retomar, retomar de novo sem linha; nenhum aviso de erro; o dono não tem linha e continua vendo a conversa em "Todas". Roda no `lab-critico` por estar no PR.

**Teste unitário ligado:** `e721-adiar-conversa.test.ts` agora exige que as colunas do `.update({...})` da ação estejam contidas no `grant update (...)` da 0336 e proíbe `.upsert(` — volta a ação antiga e o teste 6 falha (conferido).
