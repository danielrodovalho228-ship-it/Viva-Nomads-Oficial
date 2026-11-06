-- Viva Nomads — aplicar 0302 (E513: cada anúncio-semente com as próprias fotos). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0302_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E513 (prova ao vivo de 05/11): os 8 anúncios-semente da conta de teste foram clonados (0269/0270/0276) com as MESMAS 8
-- fotos, então anúncios diferentes mostram a mesma foto principal. É massa, não renderização: cada anúncio já renderiza o
-- que o banco lhe dá. Aqui cada semente passa a ter as PRÓPRIAS 8 fotos.
-- As imagens saem da pasta da conta de teste no storage, uma por conteúdo (eTag distinto), excluídas as que algum anúncio
-- que não é semente já usa. Só roda se houver imagens livres para as 8 sementes (8 × 8 = 64); senão não muda nada
-- (a QA sobe as fotos novas na conta de teste e a migração é reaplicada pela próxima rodada). Anúncios pausados sem foto
-- (placeholder cinza intencional) não entram. Idempotente: com as fotos já distintas, o resultado é o mesmo.
do $$
declare
  v_dono constant uuid := '7216d0e9-6246-482a-a1de-524fd5231dc2';
  v_base constant text := 'https://esezeutgtycekfosxplk.supabase.co/storage/v1/object/public/property-photos/';
  v_sementes constant uuid[] := array[
    'a0259000-0000-4000-8000-000000000001','a0263000-0000-4000-8000-000000000001','a0263000-0000-4000-8000-000000000002',
    'a0269000-0000-4000-8000-000000000001','a0276a00-0000-4000-8000-000000000001','a0276b00-0000-4000-8000-000000000001',
    'a0264a00-0000-4000-8000-000000000001','a0264b00-0000-4000-8000-000000000001']::uuid[];
  v_por_semente constant int := 8;
  v_livres text[];
  v_existentes uuid[];
  v_i int;
  v_k int;
begin
  select coalesce(array_agg(id), '{}') into v_existentes
    from (select id from public.properties where id = any (v_sementes) order by array_position(v_sementes, id)) s;
  if coalesce(array_length(v_existentes, 1), 0) = 0 then return; end if;

  -- uma imagem por conteúdo (eTag), a mais nova de cada, fora das que anúncios não-semente já usam
  select coalesce(array_agg(nome order by criado desc, nome), '{}') into v_livres
    from (
      select distinct on (o.metadata ->> 'eTag') o.name as nome, o.created_at as criado
        from storage.objects o
       where o.bucket_id = 'property-photos'
         and o.name like v_dono::text || '/%'
         and not exists (
           select 1 from public.property_photos pp
             join public.properties p on p.id = pp.property_id
            where pp.url = v_base || o.name and not (p.id = any (v_sementes)))
       order by o.metadata ->> 'eTag', o.created_at desc
    ) d;

  if coalesce(array_length(v_livres, 1), 0) < array_length(v_existentes, 1) * v_por_semente then
    raise notice 'E513: % imagens distintas livres; precisa de %. Nada alterado.',
      coalesce(array_length(v_livres, 1), 0), array_length(v_existentes, 1) * v_por_semente;
    return;
  end if;

  for v_i in 1 .. array_length(v_existentes, 1) loop
    delete from public.property_photos where property_id = v_existentes[v_i];
    for v_k in 1 .. v_por_semente loop
      insert into public.property_photos (property_id, url, sort_order)
      values (v_existentes[v_i], v_base || v_livres[(v_i - 1) * v_por_semente + v_k], v_k - 1);
    end loop;
  end loop;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000302', '0302_qa_fotos_proprias_sementes_e513', array['-- conteúdo em supabase/migrations/0302_qa_fotos_proprias_sementes_e513.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000302');
commit;
