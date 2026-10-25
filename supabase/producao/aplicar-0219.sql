-- Viva Nomads — aplicar 0219 (condição de retorno da avaliação por cidade — adendo 62-B1). Idempotente.
-- Rollback: supabase/producao/rollback/0219_rollback.sql.
begin;
set local lock_timeout = '5s';
-- 1. Condição de retorno por linha da tabela (preenchida pelo admin depois da cotação). Os dois nulos = não existe.
alter table public.vistoria_precos add column if not exists retorno_dias integer;
alter table public.vistoria_precos add column if not exists retorno_percentual numeric(5, 2);
alter table public.vistoria_precos drop constraint if exists vistoria_precos_retorno_check;
alter table public.vistoria_precos add constraint vistoria_precos_retorno_check check (
  (retorno_dias is null and retorno_percentual is null)
  or (retorno_dias is not null and retorno_percentual is not null and retorno_dias > 0 and retorno_percentual > 0 and retorno_percentual <= 100)
);

-- 2. Pedido: o tipo "nova_avaliacao" (depois de reprovado ou de ressalva vencida). "nova_90d" fica só para os
--    pedidos antigos. E o desconto de retorno aplicado (nulo = valor cheio da tabela).
alter table public.vistoria_pedidos drop constraint if exists vistoria_pedidos_tipo_check;
alter table public.vistoria_pedidos add constraint vistoria_pedidos_tipo_check
  check (tipo in ('inicial', 'reverificacao', 'contestacao', 'verificacao', 'nova_avaliacao', 'nova_90d'));
alter table public.vistoria_pedidos add column if not exists retorno_percentual_aplicado numeric(5, 2);
alter table public.vistoria_pedidos drop constraint if exists vistoria_pedidos_retorno_aplicado_check;
alter table public.vistoria_pedidos add constraint vistoria_pedidos_retorno_aplicado_check
  check (retorno_percentual_aplicado is null or (tipo = 'nova_avaliacao' and retorno_percentual_aplicado > 0 and retorno_percentual_aplicado <= 100));
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000219', '0219_vistoria_condicao_retorno',
       array['-- conteúdo em supabase/migrations/0219_vistoria_condicao_retorno.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000219');
commit;
