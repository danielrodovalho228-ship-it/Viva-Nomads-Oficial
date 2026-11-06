-- Viva Nomads — aplicar 0307 (E582: fixture do morador de teste sem CPF com candidatura em andamento). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0307_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E582 (resíduo, só a massa): o ramo "sem CPF" do portão do CPF está BLOQUEADO POR DADOS. Falta um morador de teste SEM CPF com uma
-- candidatura em andamento. O dono de teste (que TEM CPF) a aceita (o aceite só pede o documento do dono), abre o Fechamento e esbarra em
-- "O inquilino ainda não informou o CPF" (MSG_DOCUMENTO.fecharInquilino, leads-actions). A candidatura nasce NOVA: aceitar, e o que o aceite
-- gera, é a prova ao vivo do QA do chat principal. Os trabalhadores de QA não inventam documento nem usam as contas das rodadas: esta fixture
-- grava UMA candidatura de um morador de teste que já existia e está parado, sem tocar em conta nenhuma:
--   morador  = teste-qa-2026@mail-teste.com.br (is_teste, tenant, sem CPF e sem CNPJ, sem candidaturas nem contratos; criado em 12/10);
--   anúncio  = a0259000-…0001 "[TESTE QA] Prova de publicação" (ativo, do proprietario1, que TEM CPF; sem candidaturas nem contratos).
-- Não altera perfil, CPF, anúncio, contrato nem chave; não usa inquilino1/2, cadastro*, qa-muse-* nem os anúncios das rodadas em andamento.
-- Só roda se as duas contas e o anúncio estiverem como descrito e se o morador ainda não tem candidatura neste anúncio. Idempotente (id fixo).
-- Desfazer: supabase/producao/rollback/0307_rollback.sql. A prova ao vivo do ramo é do QA do chat principal, não desta pista.
do $$
declare
  c_lead constant uuid := 'a0307000-0000-4000-8000-000000000001';
  c_morador constant uuid := '22eccf89-2bae-4be8-97af-239c0e34f1aa';
  c_dono constant uuid := '7216d0e9-6246-482a-a1de-524fd5231dc2';
  c_anuncio constant uuid := 'a0259000-0000-4000-8000-000000000001';
begin
  if exists (select 1 from public.leads where id = c_lead) then
    raise notice '0307: a candidatura da fixture já existe; nada a fazer';
    return;
  end if;
  if not exists (
    select 1 from public.profiles
     where id = c_morador and is_teste and role = 'tenant' and cpf is null and cnpj is null
  ) then
    raise notice '0307: o morador de teste não está como esperado (conta de teste, sem CPF e sem CNPJ); nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.profiles where id = c_dono and is_teste and cpf is not null) then
    raise notice '0307: o dono de teste não está como esperado (conta de teste com CPF); nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_anuncio and owner_id = c_dono and status::text = 'active') then
    raise notice '0307: o anúncio da fixture não está ativo do dono de teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.leads where tenant_id = c_morador) or exists (select 1 from public.contratos where tenant_id = c_morador) then
    raise notice '0307: o morador de teste já tem candidatura ou contrato; nada a fazer';
    return;
  end if;
  insert into public.leads (id, owner_id, tenant_id, property_id, status, inicio_desejado, fim_desejado, qtd_ocupantes, motivo_estadia)
  values (c_lead, c_dono, c_morador, c_anuncio, 'new', current_date + 21, current_date + 81, 1, 'trabalho_remoto');
  raise notice '0307: candidatura em andamento gravada para o morador de teste sem CPF';
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000307', '0307_qa_morador_sem_cpf_candidatura_e582', array['-- conteúdo em supabase/migrations/0307_qa_morador_sem_cpf_candidatura_e582.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000307');
commit;
