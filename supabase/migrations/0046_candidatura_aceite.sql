-- ACEITE PERSISTIDO DA CANDIDATURA (P0 — espinha do marketplace).
--
-- Até aqui, "aprovar/recusar" um interessado vivia só no estado do cliente
-- (some no refresh) e não ancorava nada. Agora o aceite PERSISTE no servidor,
-- é a autoridade da revelação de identidade (nome + foto + verificação — NUNCA
-- e-mail/telefone) e CONGELA a comissão do plano vigente NA DATA DO ACEITE
-- (regra anti-relâmpago: upgrade vale para aceites futuros, downgrade não
-- retroage). O fechamento herda esse snapshot.
--
-- Vocabulário do status (fonte da verdade no servidor):
--   'new'      → candidatura em aberto (inquilino vê "Enviada"/"Em análise")
--   'accepted' → proprietário aceitou  (inquilino vê "Aceita")
--   'rejected' → proprietário recusou  (inquilino vê "Não seguiu adiante")
-- 'new' legado permanece intacto.

alter table public.leads
  add column if not exists accepted_at              timestamptz,
  add column if not exists rejected_at              timestamptz,
  add column if not exists reject_reason            text,
  add column if not exists decided_by               uuid references public.profiles (id),
  -- Snapshot do plano e da comissão (0..1) do PROPRIETÁRIO no instante do aceite.
  add column if not exists accepted_plan            text,
  add column if not exists accepted_commission_rate numeric(5, 4);

-- O DONO do lead pode transicionar o próprio lead (aprovar/recusar). A leitura
-- já é coberta por "leads das partes"; o INSERT, por "inquilino cria lead".
-- Sem esta policy a RLS bloquearia o UPDATE e o aceite não persistiria.
drop policy if exists "dono decide candidatura" on public.leads;
create policy "dono decide candidatura" on public.leads
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index if not exists leads_owner_status_idx on public.leads (owner_id, status);
create index if not exists leads_tenant_status_idx on public.leads (tenant_id, status);
