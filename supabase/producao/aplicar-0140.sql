-- Viva Nomads — aplicar 0140 (registro de envios das automações de e-mail). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0140_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.automacoes_envios') is null then
    create table public.automacoes_envios (
      chave text primary key,
      tipo text not null,
      usuario_id uuid references public.profiles (id) on delete cascade,
      criado_em timestamptz not null default now()
    );
    create index automacoes_envios_tipo_idx on public.automacoes_envios (tipo, criado_em desc);
  end if;
end $$;

alter table public.automacoes_envios enable row level security;
revoke all on public.automacoes_envios from anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261016000140', '0140_automacoes_envios',
       array['-- conteúdo em supabase/migrations/0140_automacoes_envios.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000140');
commit;
