-- Viva Nomads — aplicar 0142 (motivo da estadia na candidatura). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0142_rollback.sql.
begin;
set local lock_timeout = '5s';
alter table public.leads add column if not exists motivo_estadia text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_motivo_estadia_chk') then
    alter table public.leads add constraint leads_motivo_estadia_chk
      check (motivo_estadia is null or motivo_estadia in (
        'trabalho_remoto','tratamento_medico','relocacao_corporativa','intercambio_pos',
        'reforma_transicao','mudanca_familiar','aposentadoria_lifestyle','viagem_longa','outro'));
  end if;
end $$;
comment on column public.leads.motivo_estadia is 'Chave do motivo da estadia informado na candidatura (lista MOTIVOS). Opcional.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261016000142', '0142_leads_motivo_estadia',
       array['-- conteúdo em supabase/migrations/0142_leads_motivo_estadia.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000142');
commit;
