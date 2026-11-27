-- Viva Nomads — aplicar 0333 (E688: Plano de manutenção volta a em_breve em servicos_adicionais). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0333_rollback.sql.
begin;
set local lock_timeout = '5s';

update public.servicos_adicionais
   set status = 'em_breve'
 where id = 'plano_manutencao' and status = 'ativo';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000333', '0333_plano_manutencao_em_breve_e688', array['-- conteúdo em supabase/migrations/0333_plano_manutencao_em_breve_e688.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000333');
commit;
