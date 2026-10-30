-- 0263 — massa da prova AO VIVO do E264-B (QA do Muse, 30/10): DOIS rascunhos publicáveis do proprietario1 (is_teste),
-- "[TESTE QA] Proativo E264 A" e "… B", compatíveis com o pedido de moradia da inquilino2 (Uberlândia, entrada
-- 15/12/2026, 3 meses, 2 quartos, até R$ 4.000/mês). O e-mail proativo ao morador só sai quando um imóvel é PUBLICADO
-- depois do pedido existir: o QA publica os dois pela tela e lê a caixa de teste da inquilino2.
-- Cada rascunho já vem preenchido (2 quartos, R$ 3.200 + R$ 150 de contas, 30–180 dias, sem data) com as 8 fotos do
-- anúncio da prova de publicação (0259, mesmo dono, mesma pasta do bucket) e o DOCUMENTO já APROVADO (o mesmo critério
-- da 0259: o arquivo aprovado de um anúncio de teste do mesmo dono). O que o assistente ainda pedir (padrão mínimo de
-- conforto, termo da IA) o QA confirma na tela. Só conta e anúncios de teste; ids fixos a0263000-…; não toca a seed do
-- D-5, as automações nem o pedido da inquilino2. Idempotente.
-- Desfazer: supabase/producao/rollback/0263_rollback.sql.

do $$
declare
  v_dono uuid;
  v_fonte record;
  v_fotos jsonb;
  v_n int;
  v_imovel uuid;
  v_titulo text;
  v_bairro text;
  v_dados jsonb;
  c_imoveis constant uuid[] := array['a0263000-0000-4000-8000-000000000001', 'a0263000-0000-4000-8000-000000000002']::uuid[];
  c_qualificacoes constant uuid[] := array['a0263000-0000-4000-8000-000000000011', 'a0263000-0000-4000-8000-000000000012']::uuid[];
  c_titulos constant text[] := array['[TESTE QA] Proativo E264 A', '[TESTE QA] Proativo E264 B'];
  c_bairros constant text[] := array['Santa Mônica', 'Saraiva'];
  c_fonte_fotos constant uuid := 'a0259000-0000-4000-8000-000000000001';
begin
  -- Conta de teste por e-mail E is_teste: em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  if v_dono is null then
    raise notice '0263: conta de teste proprietario1 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  -- O arquivo aprovado mais recente do mesmo dono, num anúncio de teste (título [TESTE…]) — o mesmo critério da 0259.
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
    raise notice '0263: nenhum documento aprovado de anúncio de teste do proprietario1; nada a fazer';
    return;
  end if;
  -- As 8 fotos do anúncio de teste da prova de publicação (0259), do MESMO dono e na pasta dele no bucket.
  select jsonb_agg(jsonb_build_object('id', f.id, 'url', f.url, 'path', regexp_replace(f.url, '^.*/property-photos/', ''), 'name', '', 'demo', false) order by f.sort_order), count(*)
    into v_fotos, v_n
    from public.property_photos f
    join public.properties p on p.id = f.property_id
   where f.property_id = c_fonte_fotos and p.owner_id = v_dono;
  if coalesce(v_n, 0) < 8 then
    raise notice '0263: o anúncio da prova de publicação (0259) não tem as 8 fotos; nada a fazer';
    return;
  end if;

  for i in 1..2 loop
    v_imovel := c_imoveis[i];
    v_titulo := c_titulos[i];
    v_bairro := c_bairros[i];
    continue when exists (select 1 from public.properties where id = v_imovel);
    -- Compatível com o pedido da prova (Uberlândia, 2 quartos para 2 pessoas, 3 meses a partir de 15/12/2026, até
    -- R$ 4.000 por mês, sem pets): 2 quartos, até 4 pessoas, R$ 3.200 + R$ 150 de contas = R$ 3.350 por mês, 30 a 180
    -- dias, disponível já (sem data de início nem fim). O QA confere no assistente e publica pela tela.
    v_dados := jsonb_build_object(
      'title', v_titulo, 'propertyType', 'apartamento', 'city', 'Uberlândia', 'uf', 'MG', 'neighborhood', v_bairro,
      'street', '', 'numero', '', 'complemento', '', 'cep', '',
      'bedrooms', '2', 'bathrooms', '1', 'maxGuests', '4', 'areaM2', '62', 'parkingSpots', '1', 'internetMbps', '300',
      'monthlyPrice', '3200', 'utilitiesMode', 'fixed', 'utilitiesEstimate', 150, 'prepFee', 0, 'condoFee', '',
      'minPeriod', '30', 'maxPeriod', '180', 'availableFrom', '', 'availableUntil', '',
      'faixas', jsonb_build_object('temporada', false, 'media_estadia', true),
      'garantias', jsonb_build_object('caucao_avista', true, 'caucao_parcelada', false, 'seguro_fianca', false),
      'furnished', true, 'petsOk', false, 'smokingAllowed', false, 'childrenAllowed', true,
      'ownershipType', 'own', 'subleaseAuthorized', false, 'subleaseDoc', '[]'::jsonb, 'subleaseDocTipo', '',
      'privacidade', jsonb_build_object('tipoAcesso', 'porteiro', 'camerasExternas', '', 'semCamerasInterior', true, 'senhaTrocadaEstadia', false),
      'description', 'Apartamento mobiliado de 2 quartos para estadias de 30 a 180 dias, com home office, internet de 300 Mbps e cozinha completa. Anúncio de teste da prova dos e-mails proativos.',
      'photos', v_fotos);

    insert into public.properties (id, owner_id, status, title, city, address, bedrooms, bathrooms, max_guests, area_m2,
                                   monthly_price, utilities_mode, utilities_estimate, min_period_days, max_period_days,
                                   internet_mbps, tipo_entrada, sem_cameras_interior, draft_data)
    values (v_imovel, v_dono, 'draft', v_titulo, 'Uberlândia', v_bairro, 2, 1, 4, 62,
            3200, 'fixed', 150, 30, 180,
            300, 'porteiro', true, v_dados);

    insert into public.property_photos (property_id, url, sort_order)
    select v_imovel, f->>'url', (o - 1)::int from jsonb_array_elements(v_fotos) with ordinality as t(f, o);

    -- A qualificação DESTE rascunho com o documento aprovado (o portão do Publicar lê a última do imóvel).
    insert into public.qualification_checklists (id, owner_id, property_id, document_path, document_hash_sha256, document_uploaded_at,
                                                 document_status, document_reviewed_at, document_reviewed_by, status)
    values (c_qualificacoes[i], v_dono, v_imovel, v_fonte.document_path, v_fonte.document_hash_sha256, v_fonte.document_uploaded_at,
            'approved', now(), v_fonte.document_reviewed_by, 'pending');
  end loop;
end
$$;
