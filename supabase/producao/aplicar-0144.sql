-- Viva Nomads — aplicar 0144 (pacote de limpeza durante a estadia). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0144_rollback.sql.
begin;
set local lock_timeout = '5s';
alter table public.properties add column if not exists limpeza_estadia jsonb;
comment on column public.properties.limpeza_estadia is 'Pacote de limpeza durante a estadia: {porMes (1|2|4), inclui, valorMes}. Validado em src/lib/anuncio/limpeza-estadia.ts.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261016000144', '0144_limpeza_estadia',
       array['-- conteúdo em supabase/migrations/0144_limpeza_estadia.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000144');
commit;
