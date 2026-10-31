-- Viva Nomads — aplicar 0272 (desfaz as massas 0270/0271, revogadas). Idempotente. Aplicada pela Action no merge.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_fotos jsonb;
  c_imovel constant uuid := 'a0269000-0000-4000-8000-000000000001';
  c_fonte_fotos constant uuid := 'a0259000-0000-4000-8000-000000000001';
begin
  -- 1. E289 grupo 2 (prova revogada): sai a visita de teste da 0271, se o lembrete ainda não saiu ou saiu (pelo id fixo).
  delete from public.vistoria_pedidos where id = 'a0271000-0000-4000-8000-000000000001';

  -- 2. E274: sai da fila o cartão que a 0270 gravou e que ainda NÃO saiu (um enviado fica registrado).
  delete from public.emails_proativos
   where evento = 'pedido_imovel_novo' and ref_id = c_imovel and enviado_em is null;

  -- 3. E274: o anúncio C volta a RASCUNHO, com o mesmo draft_data da 0269, para o QA publicar pela tela.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  if v_dono is null or not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono) then
    raise notice '0272: anúncio C ou conta de teste ausente; nada mais a fazer';
    return;
  end if;
  select jsonb_agg(jsonb_build_object('id', f.id, 'url', f.url, 'path', regexp_replace(f.url, '^.*/property-photos/', ''), 'name', '', 'demo', false) order by f.sort_order)
    into v_fotos
    from public.property_photos f
    join public.properties p on p.id = f.property_id
   where f.property_id = c_fonte_fotos and p.owner_id = v_dono;
  update public.properties
     set status = 'draft',
         draft_data = jsonb_build_object(
           'title', '[TESTE QA] Proativo E274 C', 'propertyType', 'apartamento', 'city', 'Uberlândia', 'uf', 'MG', 'neighborhood', 'Santa Mônica',
           'street', '', 'numero', '', 'complemento', '', 'cep', '',
           'bedrooms', '2', 'bathrooms', '1', 'maxGuests', '4', 'areaM2', '62', 'parkingSpots', '1', 'internetMbps', '300',
           'monthlyPrice', '3200', 'utilitiesMode', 'fixed', 'utilitiesEstimate', 150, 'prepFee', 0, 'condoFee', '',
           'minPeriod', '30', 'maxPeriod', '180', 'availableFrom', '', 'availableUntil', '',
           'faixas', jsonb_build_object('temporada', false, 'media_estadia', true),
           'garantias', jsonb_build_object('caucao_avista', true, 'caucao_parcelada', false, 'seguro_fianca', false),
           'furnished', true, 'petsOk', false, 'smokingAllowed', false, 'childrenAllowed', true,
           'ownershipType', 'own', 'subleaseAuthorized', false, 'subleaseDoc', '[]'::jsonb, 'subleaseDocTipo', '',
           'tipoEntrada', 'porteiro',
           'privacidade', jsonb_build_object('tipoAcesso', 'porteiro', 'camerasExternas', '', 'semCamerasInterior', true, 'senhaTrocadaEstadia', false),
           'description', coalesce(description, 'Apartamento mobiliado de 2 quartos para estadias de 30 a 180 dias, com home office, internet de 300 Mbps e cozinha completa. Anúncio de teste da reprova da foto de capa nos e-mails proativos.'),
           'photos', coalesce(v_fotos, '[]'::jsonb))
   where id = c_imovel and status = 'active';
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261031000272', '0272_qa_desfaz_0270_0271', array['-- conteúdo em supabase/migrations/0272_qa_desfaz_0270_0271.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261031000272');
commit;
