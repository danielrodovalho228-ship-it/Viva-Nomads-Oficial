-- 0276 — E375-B: massa de QA do resumo semanal (só contas is_teste; ids fixos a0276…; idempotente).
-- (1) Dois anúncios NOVOS do proprietario1, publicados agora ("[TESTE QA] Resumo semanal 0276 A" e "… B"): cópias do
--     "[TESTE QA] Proativo E274 C" (a0269000-…0001, massa 0269/0270), com as 8 fotos e a qualificação aprovada dele —
--     combinam com os pedidos e a busca das contas inquilino1 e inquilino2 pela mesma regra do aviso. publicado_em = agora.
-- (2) "Baixou o valor": um favorito com queda do total por mês para cada uma — inquilino1 no anúncio que já favoritou
--     (ddf86c66…) e inquilino2 num anúncio novo favoritado aqui (a0263000-…0002). A queda é gravada em quedas_preco
--     (0275) com o total de hoje como "novo" e R$ 250 a mais como "antigo"; o preço do anúncio não muda.
-- Não toca o contrato-semente, AUTOMACOES_ATIVO, pedidos nem nenhum dado real. Prova: Admin → Dados de teste →
-- "Gerar resumo semanal agora" → aba E-mails. Desfazer: supabase/producao/rollback/0276_rollback.sql.

-- Clona uma linha pelo jsonb SÓ nas colunas que aceitam valor (fora as geradas — autorizacao_anexada, preco_justo… —
-- e as identity "always"): a 1ª versão copiava a linha inteira e a produção recusou ("cannot insert a non-DEFAULT value
-- into column autorizacao_anexada"; a Action desfez a 0276 inteira). Função temporária: some no fim da sessão.
create or replace function pg_temp.vn_0276_clonar(p_tabela text, p_linha jsonb) returns void
language plpgsql as $f$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = p_tabela
     and is_generated = 'NEVER' and coalesce(identity_generation, '') <> 'ALWAYS';
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', p_tabela, v_cols, v_cols, p_tabela)
    using p_linha;
end
$f$;

do $$
declare
  v_dono uuid;
  v_inq1 uuid;
  v_inq2 uuid;
  v_novo uuid;
  v_qual uuid;
  c_fonte constant uuid := 'a0269000-0000-4000-8000-000000000001';
  c_imoveis constant uuid[] := array['a0276a00-0000-4000-8000-000000000001', 'a0276b00-0000-4000-8000-000000000001']::uuid[];
  c_qualificacoes constant uuid[] := array['a0276a00-0000-4000-8000-000000000011', 'a0276b00-0000-4000-8000-000000000011']::uuid[];
  c_titulos constant text[] := array['[TESTE QA] Resumo semanal 0276 A', '[TESTE QA] Resumo semanal 0276 B'];
  c_fav_inq1 constant uuid := 'ddf86c66-a214-463d-8563-66a5204010b5';
  c_fav_inq2 constant uuid := 'a0263000-0000-4000-8000-000000000002';
  c_favorito_inq2 constant uuid := 'a0276d00-0000-4000-8000-000000000002';
  c_quedas constant uuid[] := array['a0276c00-0000-4000-8000-000000000001', 'a0276c00-0000-4000-8000-000000000002']::uuid[];
  v_total numeric;
begin
  -- Só contas de teste (e-mail E is_teste): em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_inq1 from public.profiles where lower(email) = 'inquilino1@vivanomads.com.br' and is_teste;
  select id into v_inq2 from public.profiles where lower(email) = 'inquilino2@vivanomads.com.br' and is_teste;
  if v_dono is null or v_inq1 is null or v_inq2 is null then
    raise notice '0276: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_fonte and owner_id = v_dono and status = 'active' and title ~* '^\s*\[\s*teste') then
    raise notice '0276: o anúncio de teste a0269 não está no ar para o proprietario1; nada a fazer';
    return;
  end if;

  -- (1) Os dois anúncios novos: cópia da linha inteira do a0269 (as colunas que a busca e a compatibilidade leem).
  for i in 1..2 loop
    v_novo := c_imoveis[i];
    continue when exists (select 1 from public.properties where id = v_novo);
    perform pg_temp.vn_0276_clonar('properties',
              to_jsonb(p) || jsonb_build_object('id', v_novo, 'title', c_titulos[i], 'status', 'active',
                                                'publicado_em', now(), 'created_at', now(), 'updated_at', now()))
      from public.properties p where p.id = c_fonte;
    perform pg_temp.vn_0276_clonar('property_photos', to_jsonb(f) || jsonb_build_object('id', gen_random_uuid(), 'property_id', v_novo))
      from public.property_photos f where f.property_id = c_fonte;
    -- A qualificação aprovada mais recente do a0269 (a compatibilidade exige documento aprovado).
    v_qual := c_qualificacoes[i];
    if not exists (select 1 from public.qualification_checklists where id = v_qual) then
      perform pg_temp.vn_0276_clonar('qualification_checklists', to_jsonb(q) || jsonb_build_object('id', v_qual, 'property_id', v_novo))
        from (select * from public.qualification_checklists q0
               where q0.property_id = c_fonte and q0.owner_id = v_dono and q0.document_status = 'approved'
               order by q0.created_at desc limit 1) q;
    end if;
  end loop;

  -- (2) Favorito da inquilino2 (o da inquilino1 já existe) e as duas quedas do total por mês.
  insert into public.favorites (id, tenant_id, property_id) values (c_favorito_inq2, v_inq2, c_fav_inq2)
    on conflict do nothing;
  if exists (select 1 from public.favorites where tenant_id = v_inq1 and property_id = c_fav_inq1) then
    select public.total_mes_do_imovel(monthly_price, condo_fee, utilities_mode::text, utilities_estimate) into v_total
      from public.properties where id = c_fav_inq1 and status = 'active';
    if v_total > 0 then
      insert into public.quedas_preco (id, property_id, total_antigo, total_novo) values (c_quedas[1], c_fav_inq1, v_total + 250, v_total)
        on conflict (id) do nothing;
    end if;
  end if;
  select public.total_mes_do_imovel(monthly_price, condo_fee, utilities_mode::text, utilities_estimate) into v_total
    from public.properties where id = c_fav_inq2 and status = 'active';
  if v_total > 0 then
    insert into public.quedas_preco (id, property_id, total_antigo, total_novo) values (c_quedas[2], c_fav_inq2, v_total + 250, v_total)
      on conflict (id) do nothing;
  end if;
end
$$;
