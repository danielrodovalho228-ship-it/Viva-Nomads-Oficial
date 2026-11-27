-- Viva Nomads — aplicar 0303 (E603: quartos do rascunho na coluna). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0303_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E603: o autosave do rascunho não gravava os quartos na coluna (só no draft_data): a listagem de Meus imóveis mostrava 0 num
-- rascunho de 2 quartos. O código passou a gravar; aqui os rascunhos antigos recebem o valor que já está no draft_data.
-- Só rascunho, só onde a coluna está em 0 e o draft_data tem um inteiro positivo. Idempotente.
update public.properties
   set bedrooms = least((draft_data ->> 'bedrooms')::int, 50)
 where status = 'draft'
   and coalesce(bedrooms, 0) = 0
   and draft_data ->> 'bedrooms' ~ '^[0-9]{1,2}$'
   and (draft_data ->> 'bedrooms')::int > 0;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000303', '0303_rascunho_quartos_da_coluna_e603', array['-- conteúdo em supabase/migrations/0303_rascunho_quartos_da_coluna_e603.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000303');
commit;
