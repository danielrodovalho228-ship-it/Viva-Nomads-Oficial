-- Viva Nomads — aplicar 0100 (faixas de comissão por nº de imóveis ativos: 12/10/8/6% e 31+ = Plano Gestor a 6%).
-- Aplicada pela Action "Aplicar migrações em produção" quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0100_rollback.sql. Depende da 0096 e da 0099 (faixas_comissao).
begin;
set local lock_timeout = '5s';

insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values
  (1, 2, 0.12), (3, 5, 0.10), (6, 15, 0.08), (16, 30, 0.06), (31, null, 0.06)
on conflict (min_imoveis) do update set max_imoveis = excluded.max_imoveis, taxa = excluded.taxa;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261010000100', '0100_faixas_por_imoveis',
       array['-- conteúdo em supabase/migrations/0100_faixas_por_imoveis.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261010000100');
commit;
