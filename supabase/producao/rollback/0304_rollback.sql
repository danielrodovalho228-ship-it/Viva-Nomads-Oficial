-- Rollback da 0304 (E625): tira as provas e as medições semeadas (marcador 'e625e625' no foto_hash; medições exatas de teste)
-- e devolve os dois anúncios ao Essencial. Qualquer edição do dono recalcula o nível pelo motor.
begin;
delete from public.nivel_itens
 where foto_hash like 'e625e625%'
   and property_id in ('a0263000-0000-4000-8000-000000000001', 'a0269000-0000-4000-8000-000000000001');
delete from public.internet_medicoes
 where property_id in ('a0263000-0000-4000-8000-000000000001', 'a0269000-0000-4000-8000-000000000001')
   and user_id = '7216d0e9-6246-482a-a1de-524fd5231dc2' and origem = 'cadastro' and distancia_m = 0
   and ((ponto = 'quarto_principal' and download_mbps = 120.0 and upload_mbps = 60.0) or (ponto = 'trabalho' and download_mbps = 110.0 and upload_mbps = 55.0));
update public.imovel_nivel set nivel = 'essencial', por_area = '{}'::jsonb, diferenciais = '[]'::jsonb, calculado_em = now()
 where property_id in ('a0263000-0000-4000-8000-000000000001', 'a0269000-0000-4000-8000-000000000001') and nivel in ('conforto', 'premium');
delete from supabase_migrations.schema_migrations where version = '20261105000304';
commit;
