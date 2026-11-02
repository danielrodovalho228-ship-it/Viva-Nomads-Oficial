-- Viva Nomads — aplicar 0283 (vínculo profissional: pedido novo separado do selo confirmado). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0283_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.vinculo_profissional
  add column if not exists pedido_dominio text
  check (pedido_dominio is null or (pedido_dominio = lower(pedido_dominio) and pedido_dominio ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'));

update public.vinculo_profissional set pedido_dominio = dominio where confirmado_em is null and pedido_dominio is null;

comment on column public.vinculo_profissional.pedido_dominio is
  'Domínio do pedido de vínculo em andamento. O selo (dominio + confirmado_em) só troca quando este pedido é confirmado.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261102000283', '0283_vinculo_pedido_separado', array['-- conteúdo em supabase/migrations/0283_vinculo_pedido_separado.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261102000283');
commit;
