-- Viva Nomads — aplicar 0259 (QA: rascunho "[TESTE QA] Prova de publicação" do proprietario1 com o documento aprovado). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0259_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_fonte record;
  c_imovel constant uuid := 'a0259000-0000-4000-8000-000000000001';
  c_qualificacao constant uuid := 'a0259000-0000-4000-8000-000000000002';
  c_titulo constant text := '[TESTE QA] Prova de publicação';
begin
  -- Conta de teste por e-mail E is_teste: em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  if v_dono is null then
    raise notice '0259: conta de teste proprietario1 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.properties where id = c_imovel) then
    raise notice '0259: o rascunho da prova já existe; nada a fazer';
    return;
  end if;
  -- O arquivo aprovado mais recente do mesmo dono, num anúncio de teste (título [TESTE…]).
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
    raise notice '0259: nenhum documento aprovado de anúncio de teste do proprietario1; nada a fazer';
    return;
  end if;

  -- O rascunho vazio, como o autosave deixa um anúncio recém-aberto (preço 0, sem endereço); o assistente abre com o
  -- título já preenchido (draft_data.title).
  insert into public.properties (id, owner_id, status, title, city, monthly_price, address, draft_data)
  values (c_imovel, v_dono, 'draft', c_titulo, 'Uberlândia', 0, '', jsonb_build_object('title', c_titulo));

  -- A qualificação DESTE rascunho com o documento aprovado (o portão do Publicar lê a última do imóvel).
  insert into public.qualification_checklists (id, owner_id, property_id, document_path, document_hash_sha256, document_uploaded_at,
                                               document_status, document_reviewed_at, document_reviewed_by, status)
  values (c_qualificacao, v_dono, c_imovel, v_fonte.document_path, v_fonte.document_hash_sha256, v_fonte.document_uploaded_at,
          'approved', now(), v_fonte.document_reviewed_by, 'pending');
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261030000259', '0259_qa_rascunho_prova_publicacao', array['-- conteúdo em supabase/migrations/0259_qa_rascunho_prova_publicacao.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261030000259');
commit;
