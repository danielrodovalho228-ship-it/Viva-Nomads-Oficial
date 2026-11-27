-- Viva Nomads — aplicar 0312 (E513: foto principal distinta nas sementes da conta de teste, com o que há no storage). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0312_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E513 (reprovado de novo em 05/11): "Resumo semanal 0276 A", "0276 B" e "Proativo E274 C" seguem com o MESMO arquivo de foto principal. A 0302
-- (PR #2813) só trocava vínculos e exigia 8 × 8 = 64 imagens distintas livres; a pasta da conta de teste tem 52 imagens distintas e só 16
-- livres (não usadas por anúncio que não é semente), então a 0302 saía sem mudar nada. Aqui os ARQUIVOS passam a ser outros, com o que existe:
--   • cada uma das 8 sementes recebe, no topo da galeria, imagens PRÓPRIAS (conteúdo distinto, eTag distinto): floor(livres / 8) por semente
--     (16 livres → 2 cada; com as 64 → 8 cada, como a 0302 queria). A principal (sort_order 0) é sempre uma imagem só dela;
--   • o resto da galeria (até 8 fotos) continua sendo o que a semente já tinha, sem repetir arquivo dentro do anúncio;
--   • sem imagens livres suficientes para ao menos uma por semente (8), não muda nada.
-- Idempotente: reaplicar dá o mesmo resultado. Só toca property_photos das 8 sementes da conta de teste (nunca properties).
do $$
declare
  v_dono constant uuid := '7216d0e9-6246-482a-a1de-524fd5231dc2';
  v_base constant text := 'https://esezeutgtycekfosxplk.supabase.co/storage/v1/object/public/property-photos/';
  v_sementes constant uuid[] := array[
    'a0259000-0000-4000-8000-000000000001','a0263000-0000-4000-8000-000000000001','a0263000-0000-4000-8000-000000000002',
    'a0269000-0000-4000-8000-000000000001','a0276a00-0000-4000-8000-000000000001','a0276b00-0000-4000-8000-000000000001',
    'a0264a00-0000-4000-8000-000000000001','a0264b00-0000-4000-8000-000000000001']::uuid[];
  v_total constant int := 8;
  v_livres text[];
  v_existentes uuid[];
  v_proprias int;
  v_resto text[];
  v_i int;
  v_k int;
begin
  select coalesce(array_agg(id), '{}') into v_existentes
    from (select id from public.properties where id = any (v_sementes) order by array_position(v_sementes, id)) s;
  if coalesce(array_length(v_existentes, 1), 0) = 0 then return; end if;

  -- uma imagem por conteúdo (eTag), fora das que anúncios não-semente já usam; ordem estável (nome) para o resultado ser repetível
  select coalesce(array_agg(nome order by nome), '{}') into v_livres
    from (
      select distinct on (o.metadata ->> 'eTag') o.name as nome
        from storage.objects o
       where o.bucket_id = 'property-photos'
         and o.name like v_dono::text || '/%'
         and not exists (
           select 1 from public.property_photos pp
             join public.properties p on p.id = pp.property_id
            where pp.url = v_base || o.name and not (p.id = any (v_sementes)))
       order by o.metadata ->> 'eTag', o.name
    ) d;

  v_proprias := least(v_total, coalesce(array_length(v_livres, 1), 0) / array_length(v_existentes, 1));
  if v_proprias < 1 then
    raise notice 'E513: % imagens distintas livres; precisa de ao menos % (uma por semente). Nada alterado.',
      coalesce(array_length(v_livres, 1), 0), array_length(v_existentes, 1);
    return;
  end if;

  for v_i in 1 .. array_length(v_existentes, 1) loop
    -- o que a semente já tinha, sem as imagens que viram "próprias" dela (e na ordem de antes)
    select coalesce(array_agg(nome order by ordem, nome), '{}') into v_resto
      from (
        select min(replace(pp.url, v_base, '')) as nome, min(pp.sort_order) as ordem
          from public.property_photos pp
         where pp.property_id = v_existentes[v_i]
         group by pp.url
      ) f
     where f.nome <> all (v_livres[(v_i - 1) * v_proprias + 1 : v_i * v_proprias]);

    delete from public.property_photos where property_id = v_existentes[v_i];
    for v_k in 1 .. v_proprias loop
      insert into public.property_photos (property_id, url, sort_order)
      values (v_existentes[v_i], v_base || v_livres[(v_i - 1) * v_proprias + v_k], v_k - 1);
    end loop;
    for v_k in 1 .. least(coalesce(array_length(v_resto, 1), 0), v_total - v_proprias) loop
      insert into public.property_photos (property_id, url, sort_order)
      values (v_existentes[v_i], v_base || v_resto[v_k], v_proprias + v_k - 1);
    end loop;
  end loop;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000312', '0312_qa_fotos_principais_distintas_e513', array['-- conteúdo em supabase/migrations/0312_qa_fotos_principais_distintas_e513.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000312');

commit;
