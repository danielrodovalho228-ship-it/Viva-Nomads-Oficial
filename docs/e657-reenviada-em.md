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
