-- Viva Nomads — aplicar 0214 (intenção no perfil — Prompt 49). Idempotente. Rollback: supabase/producao/rollback/0214_rollback.sql.
begin;
set local lock_timeout = '5s';
-- 0214 — profiles.intencao text[] (morar | anunciar | servicos), multi-escolha. Camada, não papel: define o painel
-- inicial e o checklist; nunca mexe em role nem em permissão. null = não respondeu; '{}' = "Agora não".
-- A pessoa só altera a própria linha (update da coluna + RLS de profiles). Reaplicar é seguro.
alter table public.profiles add column if not exists intencao text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_intencao_chk') then
    alter table public.profiles add constraint profiles_intencao_chk
      check (intencao is null or intencao <@ array['morar', 'anunciar', 'servicos']::text[]);
  end if;
end $$;

grant update (intencao) on public.profiles to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000214', '0214_intencao_perfil',
       array['-- conteúdo em supabase/migrations/0214_intencao_perfil.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000214');
commit;
