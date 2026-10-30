-- 0264 — E273/E275: massa de QA "rascunho publicável" corrigida (Muse, 30/10). Dois rascunhos do proprietario1 (is_teste),
-- "[TESTE QA] Publicável 0264 A" e "… B", que nascem 100% publicáveis pelo editor: endereço completo (CEP, rua,
-- número), garantia aceita, padrão mínimo confirmado (12 itens, lista v2), declarações do Passo 10, descrição na
-- coluna (a lista de rascunhos conta por ela), fotos (as 8 da 0259, mesmo dono) e documento aprovado (critério da 0259).
-- A 0263 deixava esses itens para a tela e repetia o código público (ids com os mesmos 6 primeiros caracteres).
-- Compatíveis com o pedido da inquilino2 (Uberlândia, 2 quartos, R$ 3.200 + R$ 150, 30–180 dias, disponível em
-- 01/11/2026). Nunca publica: o QA publica pela tela. Receita: docs/qa-receita-rascunho-publicavel.md.
-- Só conta e anúncios de teste; ids fixos a0264a00-…/a0264b00-…; não toca a seed do D-5, as automações nem pedidos.
-- Idempotente.
-- Desfazer: supabase/producao/rollback/0264_rollback.sql.

do $$
declare
  v_dono uuid;
  v_fonte record;
  v_fotos jsonb;
  v_n int;
  v_imovel uuid;
  v_titulo text;
  v_numero text;
  v_dados jsonb;
  -- E275: o código público do anúncio são os 6 primeiros caracteres do id (codigoDoImovel). Os ids da massa diferem
  -- já nesses 6 (A0264A × A0264B): os dois anúncios nunca mostram o mesmo código (a 0263 repetia "VN-A02630").
  c_imoveis constant uuid[] := array['a0264a00-0000-4000-8000-000000000001', 'a0264b00-0000-4000-8000-000000000001']::uuid[];
  c_qualificacoes constant uuid[] := array['a0264a00-0000-4000-8000-000000000011', 'a0264b00-0000-4000-8000-000000000011']::uuid[];
  c_titulos constant text[] := array['[TESTE QA] Publicável 0264 A', '[TESTE QA] Publicável 0264 B'];
  c_numeros constant text[] := array['210', '230'];
  c_fonte_fotos constant uuid := 'a0259000-0000-4000-8000-000000000001';
  -- O padrão mínimo de conforto (lista v2, 12 itens), como o editor grava ao confirmar "Todos os itens".
  c_conforto constant text[] := array['cama_colchao', 'roupa_cama_banho', 'agua_quente', 'cozinha_basica', 'ventilacao_quartos', 'iluminacao',
                                      'fechadura_entrada', 'entrega_limpa', 'internet_informada', 'mobilia_das_fotos', 'lavanderia_acesso', 'apoio_cama'];
begin
  -- Conta de teste por e-mail E is_teste: em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  if v_dono is null then
    raise notice '0264: conta de teste proprietario1 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  -- O arquivo aprovado mais recente do mesmo dono, num anúncio de teste (o critério da 0259/0263).
  select q.document_path, q.document_hash_sha256, q.document_uploaded_at, q.document_reviewed_by
    into v_fonte
    from public.qualification_checklists q
    join public.properties p on p.id = q.property_id
   where q.owner_id = v_dono
     and q.document_status = 'approved'
     and q.document_path is not null
     and q.document_eliminado_em is null
     and p.title ~* '^\s*\[\s*(teste|test|qa)\y'
   order by q.created_at desc
   limit 1;
  if v_fonte.document_path is null then
    raise notice '0264: nenhum documento aprovado de anúncio de teste do proprietario1; nada a fazer';
    return;
  end if;
  -- As 8 fotos do anúncio de teste da prova de publicação (0259), do MESMO dono e na pasta dele no bucket.
  select jsonb_agg(jsonb_build_object('id', f.id, 'url', f.url, 'path', regexp_replace(f.url, '^.*/property-photos/', ''), 'name', '', 'demo', false) order by f.sort_order), count(*)
    into v_fotos, v_n
    from public.property_photos f
    join public.properties p on p.id = f.property_id
   where f.property_id = c_fonte_fotos and p.owner_id = v_dono;
  if coalesce(v_n, 0) < 8 then
    raise notice '0264: o anúncio da prova de publicação (0259) não tem as 8 fotos; nada a fazer';
    return;
  end if;

  for i in 1..2 loop
    v_imovel := c_imoveis[i];
    v_titulo := c_titulos[i];
    v_numero := c_numeros[i];
    continue when exists (select 1 from public.properties where id = v_imovel);
    -- E273: tudo o que o editor confere para publicar já vem preenchido — endereço completo (CEP, rua, número, bairro,
    -- cidade, UF), garantia aceita, faixa, disponibilidade, tipo de entrada, câmeras, internet, declarações do Passo 10
    -- e o padrão mínimo confirmado — no rascunho (draft_data, que o editor lê) E nas colunas que a lista de rascunhos e a
    -- prontidão leem (descrição, garantias, faixas, endereço exato, coordenadas).
    v_dados := jsonb_build_object(
      'title', v_titulo, 'propertyType', 'apartamento', 'city', 'Uberlândia', 'uf', 'MG', 'neighborhood', 'Santa Mônica',
      'street', 'Avenida Ana Godoy de Sousa', 'numero', v_numero, 'complemento', '', 'cep', '38408-290',
      'bedrooms', '2', 'bathrooms', '1', 'maxGuests', '4', 'areaM2', '62', 'parkingSpots', '1', 'internetMbps', '300',
      'monthlyPrice', '3200', 'utilitiesMode', 'fixed', 'utilitiesEstimate', 150, 'prepFee', 0, 'condoFee', '',
      'minPeriod', '30', 'maxPeriod', '180', 'availableFrom', '2026-11-01', 'availableUntil', '',
      'faixas', jsonb_build_object('temporada', false, 'media_estadia', true),
      'garantias', jsonb_build_object('caucao_avista', true, 'caucao_parcelada', false, 'seguro_fianca', false),
      'negociacao', jsonb_build_object('aceita', false, 'itens', '[]'::jsonb, 'descontos', '[]'::jsonb),
      'furnished', true, 'petsOk', false, 'smokingAllowed', false, 'childrenAllowed', true, 'issuesInvoice', false,
      'ownershipType', 'own', 'subleaseAuthorized', false, 'subleaseDoc', '[]'::jsonb, 'subleaseDocTipo', '',
      'privacidade', jsonb_build_object('tipoAcesso', 'porteiro', 'camerasExternas', '', 'semCamerasInterior', true, 'senhaTrocadaEstadia', false),
      'declaracoesPasso10', jsonb_build_object('iptuOk', true, 'habitavel', true, 'convencao', 'yes'),
      'qualificacaoConforto', jsonb_build_object('status', 'pulada', 'respostas', '{}'::jsonb),
      'description', 'Apartamento mobiliado de 2 quartos no Santa Mônica para estadias de 30 a 180 dias, com home office, internet de 300 Mbps, cozinha completa e portaria. Anúncio de teste do QA.',
      'photos', v_fotos);

    insert into public.properties (id, owner_id, status, title, description, property_type, city, state, address, exact_address,
                                   cep_proximidades, lat, lng, lat_exata, lng_exata, bedrooms, bathrooms, max_guests, area_m2,
                                   parking_spots, monthly_price, utilities_mode, utilities_estimate, min_period_days, max_period_days,
                                   available_from, faixas_aceitas, garantias_aceitas, internet_mbps, tipo_entrada, sem_cameras_interior,
                                   furnished, ownership_type, draft_data)
    values (v_imovel, v_dono, 'draft', v_titulo, v_dados->>'description', 'apartamento', 'Uberlândia', 'MG', 'Santa Mônica',
            'Avenida Ana Godoy de Sousa, ' || v_numero, '38408290', -18.909872, -48.259454, -18.9113, -48.2622, 2, 1, 4, 62,
            1, 3200, 'fixed', 150, 30, 180,
            date '2026-11-01', array['media_estadia'], array['caucao_avista'], 300, 'porteiro', true,
            true, 'own', v_dados);

    insert into public.property_photos (property_id, url, sort_order)
    select v_imovel, f->>'url', (o - 1)::int from jsonb_array_elements(v_fotos) with ordinality as t(f, o);

    -- O padrão mínimo de conforto confirmado pelo dono (o que o "Marcar todos" do editor grava).
    insert into public.conforto_declaracoes (property_id, chave, confirmado, confirmado_por, confirmado_em, versao_lista)
    select v_imovel, c, true, v_dono, now(), 2 from unnest(c_conforto) as c;

    -- A qualificação DESTE rascunho com o documento aprovado (o portão do Publicar lê a última do imóvel).
    insert into public.qualification_checklists (id, owner_id, property_id, document_path, document_hash_sha256, document_uploaded_at,
                                                 document_status, document_reviewed_at, document_reviewed_by, status)
    values (c_qualificacoes[i], v_dono, v_imovel, v_fonte.document_path, v_fonte.document_hash_sha256, v_fonte.document_uploaded_at,
            'approved', now(), v_fonte.document_reviewed_by, 'pending');
  end loop;
end
$$;
