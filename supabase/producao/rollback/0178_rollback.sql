-- Rollback da 0178: tira o avise-me por categoria e as 3 categorias novas (os nomes com acento ficam: são correção).
begin;
drop table if exists public.interesse_servico;
delete from public.servicos_adicionais
 where id in ('limpeza', 'lavanderia_enxoval', 'frete_mudanca')
   and not exists (select 1 from public.servicos_pedidos p where p.servico_id = servicos_adicionais.id);
alter table public.servicos_adicionais drop column if exists resumo;
delete from supabase_migrations.schema_migrations where version = '20261019000178';
commit;
