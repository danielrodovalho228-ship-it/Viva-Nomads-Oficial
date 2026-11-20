-- Viva Nomads — aplicar 0325 (E682: termos próprios do avaliador). Idempotente. Rollback: supabase/producao/rollback/0325_rollback.sql.
begin;
set local lock_timeout = '5s';
alter table public.avaliadores_credenciamento
  add column if not exists preco_proprio numeric(10, 2) check (preco_proprio is null or preco_proprio > 0),
  add column if not exists prazo_entrega_dias integer check (prazo_entrega_dias is null or prazo_entrega_dias between 1 and 30),
  add column if not exists prazo_resposta_horas integer check (prazo_resposta_horas is null or prazo_resposta_horas between 1 and 72);

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000325', '0325_termos_do_avaliador_e682', array['-- conteúdo em supabase/migrations/0325_termos_do_avaliador_e682.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000325');

commit;
