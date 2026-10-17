-- Viva Nomads — aplicar 0154 (leads.qtd_ocupantes: quantas pessoas vão morar). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0154_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.leads add column if not exists qtd_ocupantes smallint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_qtd_ocupantes_chk') then
    alter table public.leads add constraint leads_qtd_ocupantes_chk check (qtd_ocupantes is null or qtd_ocupantes between 1 and 20);
  end if;
end $$;
comment on column public.leads.qtd_ocupantes is 'Quantas pessoas vão morar, informado na candidatura (1 a 20, até a capacidade do imóvel). Opcional.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261017000154', '0154_leads_qtd_ocupantes',
       array['-- conteúdo em supabase/migrations/0154_leads_qtd_ocupantes.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261017000154');
commit;
