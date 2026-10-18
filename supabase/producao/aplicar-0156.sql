-- Viva Nomads — aplicar 0156 (dono aprova o rascunho de "Publicamos para você"). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0156_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.pedidos_ajuda_publicacao drop constraint if exists pedidos_ajuda_publicacao_status_check;
alter table public.pedidos_ajuda_publicacao add constraint pedidos_ajuda_publicacao_status_check
  check (status in ('recebido', 'em_montagem', 'enviado_dono', 'aprovado_dono', 'ajustes_pedidos', 'cancelado'));

drop policy if exists ajuda_publicacao_dono_decide on public.pedidos_ajuda_publicacao;
create policy ajuda_publicacao_dono_decide on public.pedidos_ajuda_publicacao
  for update to authenticated
  using (owner_id = (select auth.uid()) and status = 'enviado_dono')
  with check (
    owner_id = (select auth.uid())
    and status in ('aprovado_dono', 'ajustes_pedidos')
    and (property_id is null or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())))
  );

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000156', '0156_ajuda_publicacao_decisao_dono',
       array['-- conteúdo em supabase/migrations/0156_ajuda_publicacao_decisao_dono.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000156');
commit;
