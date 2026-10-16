-- Viva Nomads — aplicar 0141 (motivo da estadia no perfil). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0141_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.profiles add column if not exists motivo_estadia text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_motivo_estadia_chk') then
    alter table public.profiles add constraint profiles_motivo_estadia_chk
      check (motivo_estadia is null or motivo_estadia in (
        'trabalho_remoto','tratamento_medico','relocacao_corporativa','intercambio_pos',
        'reforma_transicao','mudanca_familiar','aposentadoria_lifestyle','viagem_longa','outro'));
  end if;
end $$;

grant update (motivo_estadia) on public.profiles to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261016000141', '0141_motivo_estadia_perfil',
       array['-- conteúdo em supabase/migrations/0141_motivo_estadia_perfil.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000141');
commit;
