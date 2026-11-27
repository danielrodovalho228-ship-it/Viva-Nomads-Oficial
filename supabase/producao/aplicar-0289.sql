-- Viva Nomads — aplicar 0289 (QA: documento do rascunho de teste 4a693a63 do proprietario2 aprovado por fixture). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0289_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  -- Conta de teste por e-mail E is_teste: em qualquer outra base, nada acontece.
  v_dono uuid;
  v_revisor uuid;
  v_n int;
  c_imovel constant uuid := '4a693a63-8f4e-453c-a888-cd0ea9ccc4ff';
  c_qualificacao constant uuid := '4f52b6aa-b9f8-4406-979b-6ee397bf10cf';
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario2@vivanomads.com.br' and is_teste;
  if v_dono is null then
    raise notice '0289: conta de teste proprietario2 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  -- Só o rascunho de teste do Paulo (título TESTE QA…), ainda rascunho.
  if not exists (
    select 1 from public.properties
     where id = c_imovel and owner_id = v_dono and status::text = 'draft' and title ~* '^\s*\[?\s*teste\s*qa'
  ) then
    raise notice '0289: rascunho de teste 4a693a63 ausente, de outro dono ou já não é rascunho; nada a fazer';
    return;
  end if;
  -- O revisor é o admin que já decidiu um documento deste mesmo dono (nunca uma decisão sem revisor).
  select q.document_reviewed_by into v_revisor
    from public.qualification_checklists q
   where q.owner_id = v_dono and q.document_reviewed_by is not null and q.document_reviewed_by <> v_dono
   order by q.document_reviewed_at desc nulls last
   limit 1;
  if v_revisor is null then
    raise notice '0289: nenhum revisor anterior dos documentos do proprietario2; nada a fazer';
    return;
  end if;

  -- O documento "Em análise" deste rascunho passa a aprovado, como a decisão do admin grava (montarDecisaoDocumento).
  -- Só a linha pendente, com arquivo, deste imóvel e deste dono. O e-mail de decisão NÃO sai (é teste).
  update public.qualification_checklists
     set document_status = 'approved',
         document_review_reason = null,
         document_reviewed_at = now(),
         document_reviewed_by = v_revisor
   where id = c_qualificacao
     and owner_id = v_dono
     and property_id = c_imovel
     and document_status = 'pending'
     and document_path is not null;
  get diagnostics v_n = row_count;
  raise notice '0289: % documento(s) aprovado(s) por fixture', v_n;
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261104000289', '0289_qa_documento_rascunho_4a693a63', array['-- conteúdo em supabase/migrations/0289_qa_documento_rascunho_4a693a63.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261104000289');
commit;
