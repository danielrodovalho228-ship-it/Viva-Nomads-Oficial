-- Viva Nomads — aplicar 0364 (E1180: o prazo de entrega do credenciamento no teto de 5 dias). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0364_rollback.sql.
-- Só troca a regra da coluna; nenhum dado é alterado. Se alguma linha estiver acima de 5, para sem mudar nada.
begin;
set local lock_timeout = '5s';

alter table public.avaliadores_credenciamento
  drop constraint if exists avaliadores_credenciamento_prazo_entrega_dias_check,
  add constraint avaliadores_credenciamento_prazo_entrega_dias_check
  check (prazo_entrega_dias is null or prazo_entrega_dias between 1 and 5);

insert into supabase_migrations.schema_migrations (version, name)
select '20261125000364', '0364_avaliador_prazo_de_entrega_no_teto_e1180'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261125000364');
commit;
