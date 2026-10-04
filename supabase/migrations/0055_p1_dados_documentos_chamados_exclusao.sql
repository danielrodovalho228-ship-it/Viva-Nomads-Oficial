-- ════════════════════════════════════════════════════════════════════════════
-- 0055 — P1 (dados). Aplicar DEPOIS da 0052. Independe de 0053/0054.
-- Idempotente (drop/create, if not exists): reaplicar é seguro.
--
--   F1   documents (orçamentos/contratos): o property_id tem que ser NULO ou de
--        um imóvel do PRÓPRIO dono. Antes, qualquer usuário logado criava pela
--        API um documento apontando para o imóvel de outra pessoa e endereçado a
--        qualquer inquilino (que passava a vê-lo).
--   F1   service_orders (chamados de manutenção): o inquilino só abre chamado se
--        tiver contrato 'ativo' ou 'encerrado_em_acerto' naquele imóvel, e o
--        owner_id tem que ser o dono REAL do imóvel. O dono só atualiza chamados
--        de imóveis seus (sem trocar o imóvel para o de outra pessoa).
--   M1   exclusão de conta pela página pública: conta achada por e-mail EXATO
--        (uid_por_email_exato, só service_role) e pedidos registrados para o
--        link ser de USO ÚNICO e haver limite por e-mail/IP (só hashes).
--
-- Rollback: supabase/producao/rollback/0055_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── F1 — documents ──────────────────────────────────────────────────────────
drop policy if exists "documentos do proprietário" on public.documents;
create policy "documentos do proprietário" on public.documents
  for all using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      property_id is null
      or exists (
        select 1 from public.properties p
        where p.id = documents.property_id and p.owner_id = auth.uid()
      )
    )
  );

-- ── F1 — service_orders ─────────────────────────────────────────────────────
drop policy if exists "inquilino abre chamado" on public.service_orders;
create policy "inquilino abre chamado" on public.service_orders
  for insert with check (
    tenant_id = auth.uid()
    and exists (
      select 1 from public.properties p
      where p.id = service_orders.property_id and p.owner_id = service_orders.owner_id
    )
    and exists (
      select 1 from public.contratos c
      where c.property_id = service_orders.property_id
        and c.tenant_id = auth.uid()
        and c.status in ('ativo', 'encerrado_em_acerto')
    )
  );

drop policy if exists "proprietário atualiza status" on public.service_orders;
create policy "proprietário atualiza status" on public.service_orders
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.properties p
      where p.id = service_orders.property_id and p.owner_id = auth.uid()
    )
  );

-- ── M1 — e-mail exato e pedidos de exclusão ─────────────────────────────────
-- Igualdade (sem LIKE/ILIKE: "_" e "%" são só caracteres). Só devolve o uid se
-- houver EXATAMENTE uma conta com aquele e-mail.
create or replace function public.uid_por_email_exato(e text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select case when count(*) = 1 then (array_agg(u.id))[1] end
  from auth.users u
  where lower(u.email) = lower(trim(e));
$$;
revoke all on function public.uid_por_email_exato(text) from public, anon, authenticated;
grant execute on function public.uid_por_email_exato(text) to service_role;

create table if not exists public.exclusao_conta_pedidos (
  id uuid primary key default gen_random_uuid(),
  uid uuid,                          -- nulo quando não há conta (conta p/ o limite)
  email_hash text not null,          -- HMAC do e-mail (nunca o e-mail)
  ip_hash text not null,             -- HMAC do IP (nunca o IP)
  criado_em timestamptz not null default now(),
  usado_em timestamptz               -- preenchido no 1º uso do link (uso único)
);
create index if not exists exclusao_conta_pedidos_email_idx on public.exclusao_conta_pedidos (email_hash, criado_em desc);
create index if not exists exclusao_conta_pedidos_ip_idx on public.exclusao_conta_pedidos (ip_hash, criado_em desc);
alter table public.exclusao_conta_pedidos enable row level security;
-- Sem políticas: só o servidor (service_role) lê/escreve.
revoke all on public.exclusao_conta_pedidos from anon, authenticated;
