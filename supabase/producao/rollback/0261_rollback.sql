-- Rollback da 0261: sai tudo o que a massa da prova do E213 criou e o que a prova fez nela — os pedidos de limpeza dos
-- dois contratos (os da massa, os cancelados com ":remarcado:" e os que o cron refez no D-5 da nova saída), com os
-- eventos e o registro VN-SV deles; os dois contratos (blocos, aditivos e assinaturas em cascata) com o registro VN-CT
-- deles e dos aditivos; as chaves de envio que citam os contratos ou os pedidos; os vínculos, o serviço, o parceiro de
-- teste e a solicitação dele. Nada de outro contrato, anúncio ou parceiro é tocado (tudo por id fixo a0261000-…, a0261a00-… e a0261b00-…).
begin;
set local lock_timeout = '5s';
do $$
declare
  c_contratos constant uuid[] := array['a0261a00-0000-4000-8000-000000000022', 'a0261b00-0000-4000-8000-000000000032']::uuid[];
  c_parceiro constant uuid := 'a0261000-0000-4000-8000-000000000011';
  v_pedidos uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_pedidos
    from public.parceiro_pedidos where contrato_id = any (c_contratos) or parceiro_id = c_parceiro;
  delete from public.automacoes_envios e
   where exists (select 1 from unnest(c_contratos) k where e.chave like '%' || k::text || '%')
      or exists (select 1 from unnest(v_pedidos) k where e.chave like '%' || k::text || '%');
  delete from public.documentos_registro
   where (ref_tabela = 'parceiro_pedidos' and ref_id = any (v_pedidos))
      or (ref_tabela = 'contratos' and ref_id = any (c_contratos))
      or (ref_tabela = 'contrato_aditivos' and ref_id in (select id from public.contrato_aditivos where contrato_id = any (c_contratos)));
  delete from public.parceiro_pedidos where id = any (v_pedidos);
  delete from public.contratos where id = any (c_contratos);
  delete from public.imovel_parceiros where id in ('a0261000-0000-4000-8000-000000000021', 'a0261000-0000-4000-8000-000000000031');
  delete from public.parceiros where id = c_parceiro;
  delete from public.parceiro_solicitacoes where id = 'a0261000-0000-4000-8000-000000000010';
end
$$;
delete from supabase_migrations.schema_migrations where version = '20261030000261';
commit;
