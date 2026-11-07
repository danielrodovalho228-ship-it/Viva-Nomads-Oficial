# E657 — "Enviada em" mostra o reenvio (migração 0315, aprovada pelo Daniel em 07/11/2026)

Causa (conferida no banco, somente-leitura): a candidatura VN-PD-A65945B6 foi criada em 04/11 (`created_at`) e reenviada em 06/11. A
candidatura repetida (E581) atualiza período, motivo e pessoas, mas `created_at` não muda — a lista mostrava a criação.

Correção:
- **Migração 0315** (`supabase/migrations/0315_candidatura_reenviada_em_e657.sql`, `aplicar-0315.sql` idempotente com registro, rollback):
  só `leads.reenviada_em timestamptz` anulável + `grant select (reenviada_em)` (o usuário lê o lead por grant de coluna, 0062). Sem dado pessoal novo;
  sem alterar nenhuma linha existente (as candidaturas antigas seguem mostrando a criação).
- A candidatura repetida grava `reenviada_em = agora` ao atualizar o lead (`requestLead`).
- A lista do morador seleciona `reenviada_em` e mostra `enviadaEm = reenviada_em ?? created_at` no calendário de Brasília.
- A candidatura do caso (já reenviada antes da migração) continua mostrando 04/11 até um novo reenvio — não preenchi retroativamente (o banco não
  guarda quando houve o reenvio).

Numeração: 0315 porque a 0314 é a do E647 (#2951, ainda em PR); a ordem de aplicação não importa (a Action aplica o que falta).
Teste: `src/lib/data/e657-reenvio-candidatura.test.ts` (visto vermelho antes). Atualizados dois guardas que fixavam o texto (E581, E657 de fuso).
Inventário E293: a coluna é só uma data da candidatura (item `leads` já existente); nada muda no prazo.

## Reprova da prova ao vivo de 07/11 — diagnóstico e o que mais entra neste PR
**Sintoma:** VN-PD-A65945B6 (Lucas × anúncio de teste do Paulo, Aceita) seguia com "Enviada em 04/11/2026", sem selo e sem segunda data; o dono não via "Enviada em" em vista nenhuma.
**Fonte da data (somente leitura, produção):** o lead foi criado em 04/11 23:37 UTC; a última mensagem do morador ao dono é de 07/11 00:09 UTC (06/11 21:09 BRT, o "Ontem, 21:09" da tela de Mensagens). Ou seja, 04/11 estava **certo para a criação** e o envio real (o reenvio) não tinha onde ser guardado. A coluna `reenviada_em` é a causa: ela é a migração 0315 deste PR, que ainda é rascunho, então a produção ainda não a tem. O defeito de fuso já foi corrigido pelo #3057.
**Entra neste PR:**
1. `src/lib/candidaturas-envio.ts` — regra única do envio (último envio, selo, primeiro envio), usada pelo morador e pelo dono.
2. **Morador:** o cartão mostra o selo "Reenviada" e "Enviada pela primeira vez em 04/11/2026" junto da data do último envio.
3. **Dono (omissão, não desenho):** Interessados e o perfil do candidato mostram "Enviada em …" (com "reenviada, primeiro envio em …"). A máscara do candidato não muda (nada de nome/contato antes do aceite). A coluna nova é lida à parte e tolerante: se a migração atrasar, a lista do dono não quebra.
4. **Preenchimento do caso conhecido na própria 0315:** só o lead `a65945b6-…`, só entre contas de teste, só se `reenviada_em` for nula: recebe o instante da mensagem do reenvio (a última do morador ao dono depois da criação), 07/11 00:09 UTC. Nenhum outro lead é tocado. O rollback anula esse valor antes de remover a coluna.
**Teste:** `src/lib/candidaturas-envio.test.ts`; o guarda `e657-reenvio-candidatura` passou a fixar a regra única.
