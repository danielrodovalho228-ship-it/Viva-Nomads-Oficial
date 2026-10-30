-- Viva Nomads — aplicar 0258 (leads.fim_desejado: a saída escolhida na candidatura). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0258_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.leads add column if not exists fim_desejado date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_fim_desejado_chk') then
    alter table public.leads add constraint leads_fim_desejado_chk
      check (fim_desejado is null or (inicio_desejado is not null and fim_desejado > inicio_desejado));
  end if;
end $$;
comment on column public.leads.fim_desejado is 'Data de saída desejada, informada na candidatura (depois da entrada). Opcional; os e-mails e o Fechamento usam o período.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261030000258', '0258_leads_fim_desejado',
       array['-- conteúdo em supabase/migrations/0258_leads_fim_desejado.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261030000258');
commit;
