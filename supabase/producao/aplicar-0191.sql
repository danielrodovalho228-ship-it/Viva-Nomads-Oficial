-- Viva Nomads — aplicar 0191 (registro da cópia noturna e do teste de restauração). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0191_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.backups_execucoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('copia', 'drill')),
  inicio timestamptz not null,
  fim timestamptz,
  ok boolean not null,
  motivo text check (motivo is null or (char_length(motivo) <= 300 and position('@' in motivo) = 0)),
  bytes_banco bigint check (bytes_banco is null or bytes_banco >= 0),
  objetos_storage bigint check (objetos_storage is null or objetos_storage >= 0),
  bytes_storage bigint check (bytes_storage is null or bytes_storage >= 0),
  duracao_restauracao_s integer check (duracao_restauracao_s is null or duracao_restauracao_s >= 0),
  -- Total usado na pasta do Drive (cifrada), medido pela cópia. Acima de 10 GB o cartão sugere o Google One.
  bytes_pasta bigint check (bytes_pasta is null or bytes_pasta >= 0),
  criado_em timestamptz not null default now(),
  constraint backups_execucoes_fim_depois check (fim is null or fim >= inicio)
);
create index if not exists backups_execucoes_tipo_inicio_idx on public.backups_execucoes (tipo, inicio desc);

alter table public.backups_execucoes enable row level security;
revoke all on public.backups_execucoes from public, anon, authenticated;
grant select on public.backups_execucoes to authenticated;
grant all on public.backups_execucoes to service_role;

-- "to authenticated" (nunca o role public): is_admin() não é executável pelo anon (0084/2, 0189).
drop policy if exists backups_execucoes_admin_le on public.backups_execucoes;
create policy backups_execucoes_admin_le on public.backups_execucoes for select to authenticated
  using (public.is_admin());

comment on table public.backups_execucoes is 'Cópia noturna cifrada e teste de restauração semanal (Resiliência 2). Sem dado de usuário: datas, tamanhos, contagens, OK e motivo curto.';

-- Conferência (somente leitura):
--   select count(*) from public.backups_execucoes;                                      -- 0 logo depois de aplicar
--   select policyname, roles from pg_policies where tablename = 'backups_execucoes';    -- {authenticated}

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000191', '0191_backups_execucoes',
       array['-- conteúdo em supabase/migrations/0191_backups_execucoes.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000191');
commit;
