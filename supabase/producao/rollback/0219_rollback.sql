-- Viva Nomads — rollback da 0219 (condição de retorno — adendo 62-B1). Idempotente.
-- Os pedidos "nova_avaliacao" voltam a "inicial" (o tipo antigo não existia sem desconto); as colunas novas saem.
begin;
set local lock_timeout = '5s';
alter table public.vistoria_pedidos drop constraint if exists vistoria_pedidos_retorno_aplicado_check;
alter table public.vistoria_pedidos drop column if exists retorno_percentual_aplicado;
update public.vistoria_pedidos set tipo = 'inicial' where tipo = 'nova_avaliacao';
alter table public.vistoria_pedidos drop constraint if exists vistoria_pedidos_tipo_check;
alter table public.vistoria_pedidos add constraint vistoria_pedidos_tipo_check
  check (tipo in ('inicial', 'reverificacao', 'contestacao', 'verificacao', 'nova_90d'));
alter table public.vistoria_precos drop constraint if exists vistoria_precos_retorno_check;
alter table public.vistoria_precos drop column if exists retorno_percentual;
alter table public.vistoria_precos drop column if exists retorno_dias;
delete from supabase_migrations.schema_migrations where version = '20261023000219';
commit;
