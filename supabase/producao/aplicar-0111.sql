-- Viva Nomads — aplicar 0111 (registro da assinatura eletrônica do contrato, ordem 0fd301f0).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0111_rollback.sql (perde os registros de assinatura).
begin;
set local lock_timeout = '5s';

create table if not exists public.contrato_assinaturas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  papel text not null check (papel in ('proprietario', 'inquilino')),
  assinado_em timestamptz not null default now(),
  ip text,
  hash_documento text not null check (hash_documento ~ '^[0-9a-f]{64}$'),
  unique (contrato_id, papel)
);

comment on table public.contrato_assinaturas is 'Assinatura eletrônica na plataforma: quem/quando/IP/hash do resumo visto. Só o servidor grava.';

alter table public.contrato_assinaturas enable row level security;

drop policy if exists "assinatura visível às partes" on public.contrato_assinaturas;
create policy "assinatura visível às partes" on public.contrato_assinaturas
  for select using (
    exists (
      select 1 from public.contratos c
      join public.properties p on p.id = c.property_id
      where c.id = contrato_assinaturas.contrato_id
        and (c.tenant_id = auth.uid() or p.owner_id = auth.uid())
    )
  );
revoke insert, update, delete on public.contrato_assinaturas from anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261013000111', '0111_contrato_assinaturas_registro',
       array['-- conteúdo em supabase/migrations/0111_contrato_assinaturas_registro.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261013000111');
commit;
