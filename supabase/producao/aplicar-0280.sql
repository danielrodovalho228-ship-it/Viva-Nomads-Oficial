-- Viva Nomads — aplicar 0280 (E399-C pacote 2: resultado da comparação do Preço justo). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (depois da 0279). Rollback: supabase/producao/rollback/0280_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.preco_justo_airbnb add column if not exists total_30_noites numeric(12, 2) check (total_30_noites is null or total_30_noites > 0);
alter table public.preco_justo_airbnb add column if not exists consultado_em timestamptz;
alter table public.preco_justo_airbnb add column if not exists aviso_enviado_em timestamptz;
alter table public.preco_justo_airbnb add column if not exists aviso_valor numeric(12, 2);

create index if not exists preco_justo_airbnb_consulta_idx on public.preco_justo_airbnb (consultado_em nulls first) where conferencia = 'confere';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261101000280', '0280_preco_justo_comparacao', array['-- conteúdo em supabase/migrations/0280_preco_justo_comparacao.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261101000280');
commit;
