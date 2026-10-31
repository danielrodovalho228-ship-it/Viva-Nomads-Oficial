-- Rollback da 0268: sai tudo o que a massa da prova do E289 criou, só por id fixo a0268…: a proposta (versões em
-- cascata) e o lead, os 4 contratos (blocos em cascata) com o registro VN-CT deles, as chaves de envio que citam os
-- contratos, os blocos ou a proposta, e os 3 anúncios de teste. Nada de outra conta, anúncio ou massa é tocado.
begin;
set local lock_timeout = '5s';
do $$
declare
  c_imoveis constant uuid[] := array['a0268a00-0000-4000-8000-000000000001', 'a0268b00-0000-4000-8000-000000000001', 'a0268c00-0000-4000-8000-000000000001']::uuid[];
  c_contratos constant uuid[] := array['a0268a00-0000-4000-8000-000000000011', 'a0268b00-0000-4000-8000-000000000011', 'a0268b00-0000-4000-8000-000000000021', 'a0268c00-0000-4000-8000-000000000011']::uuid[];
  c_proposta constant uuid := 'a0268c00-0000-4000-8000-000000000032';
  v_blocos uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_blocos from public.contrato_blocos where contrato_id = any (c_contratos);
  delete from public.automacoes_envios e
   where exists (select 1 from unnest(c_contratos || v_blocos || c_proposta) k where e.chave like '%' || k::text || '%');
  delete from public.documentos_registro where ref_tabela = 'contratos' and ref_id = any (c_contratos);
  delete from public.documentos_registro where ref_tabela = 'propostas' and ref_id = c_proposta;
  delete from public.propostas where id = c_proposta;
  delete from public.leads where id = 'a0268c00-0000-4000-8000-000000000031';
  delete from public.contratos where id = any (c_contratos);
  delete from public.properties where id = any (c_imoveis);
end
$$;
delete from supabase_migrations.schema_migrations where version = '20261031000268';
commit;
