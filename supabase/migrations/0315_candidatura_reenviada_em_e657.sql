-- E657 (aprovada pelo Daniel em 07/11/2026) — a candidatura REENVIADA guarda a data do reenvio.
-- A candidatura repetida (E581) atualiza período, motivo e pessoas do lead ainda sem resposta, mas `created_at` não muda:
-- enviada em 06/11, a lista mostrava 04/11. Coluna aditiva e anulável; a lista passa a mostrar `reenviada_em ?? created_at`.
-- Só o dado de data (sem dado pessoal novo). O usuário já lê as outras colunas do lead por grant de coluna (0062): libera esta também.
alter table public.leads
  add column if not exists reenviada_em timestamptz;

comment on column public.leads.reenviada_em is 'Quando a candidatura foi reenviada (E581/E657); null = nunca reenviada (vale created_at).';

grant select (reenviada_em) on public.leads to authenticated;
