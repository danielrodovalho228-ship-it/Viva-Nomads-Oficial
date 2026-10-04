-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO DE SEGURANÇA P0 — SQL Editor do Supabase (produção). Só LEITURA
-- (a seção B5 usa begin/rollback e não muda nada).
--
-- Sequência:
--   1) ANTES: rodar só a seção A (+ backup-antes-p0.sql) → guardar a saída
--      (as seções B/C/D citam objetos que só existem depois das migrações)
--   2) aplicar 0052 → rodar A + B      → tudo "OK" (exceto B3c/B4b/B8, que
--      são da 0054)
--   3) merge + deploy no ar → testar o site
--   4) aplicar 0053 → rodar A + B + C  → tudo "OK"
--   4b) aplicar 0054 (a qualquer momento depois da 0052) → B3c/B4b/B8 "OK"
--   5) depois de alguns dias sem problema: seção D (apagar o backup do draft_data)
-- ════════════════════════════════════════════════════════════════════════════


-- ████ A — SEMPRE ████████████████████████████████████████████████████████████

-- A1) QUEM É ADMIN HOJE (deve ser só você, dtrodovalho40@gmail.com) -----------
select 'A1. admins' as checagem, id, email, role
from public.profiles where role = 'admin' order by email;

-- A2) Quem pode executar as 4 RPCs de contato (guarde a saída ANTES: o rollback
--     da 0053 usa isto para saber se 'anon' tinha execute) ---------------------
select 'A2. execute das RPCs de PII' as checagem, p.proname as rpc,
       coalesce(string_agg(distinct g.grantee, ', '), '(ninguém)') as quem_pode_executar
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join information_schema.role_routine_grants g
  on g.specific_schema = n.nspname and g.routine_name = p.proname
 and g.grantee in ('authenticated', 'anon') and g.privilege_type = 'EXECUTE'
where n.nspname = 'public'
  and p.proname in ('owner_notify_contact', 'message_notify_contact',
                    'pedido_owner_recipients', 'pedido_inquilino_recipient')
group by p.proname order by p.proname;


-- ████ B — DEPOIS DA 0052 ████████████████████████████████████████████████████

-- B1) C1 — handle_new_user NÃO aceita 'admin' --------------------------------
select 'B1. C1 handle_new_user' as checagem,
       -- procura a lista ANTIGA ('owner','tenant','admin'), não a palavra solta
       -- (o comentário da função nova cita 'admin').
       case when pg_get_functiondef(p.oid) like '%''tenant'', ''admin''%'
            then 'VULNERÁVEL — ainda aceita admin' else 'OK — só owner|tenant' end as status
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_user';

-- B2) PJ1 — handle_new_user grava person_type --------------------------------
select 'B2. PJ1 handle_new_user' as checagem,
       case when pg_get_functiondef(p.oid) like '%person_type%'
            then 'OK — grava person_type' else 'FALTANDO' end as status
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_user';

-- B3) C2 — trigger + nenhuma coluna de confiança com UPDATE para authenticated
select 'B3. C2 trigger profiles' as checagem,
       case when count(*) > 0 then 'OK — trigger presente' else 'VULNERÁVEL — sem trigger' end as status
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and tgname = 'trg_profiles_bloqueia_confianca' and not tgisinternal;

select 'B3b. C2 UPDATE em coluna de confiança' as checagem,
       case when count(*) = 0 then 'OK — nenhuma'
            else 'VULNERÁVEL — ' || string_agg(column_name, ', ') end as status
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('authenticated', 'anon') and privilege_type = 'UPDATE'
  and column_name in ('role', 'email', 'is_verified', 'verification_progress', 'fundador',
                      'fundador_em', 'account_type', 'cpf', 'person_type', 'anonymized_at',
                      'referred_by', 'referral_code');

-- B3c (0054)
select 'B3c. C2 trigger trava indicação (0054)' as checagem,
       case when pg_get_functiondef(p.oid) like '%referred_by%'
             and pg_get_functiondef(p.oid) like '%referral_code%'
            then 'OK — referred_by e referral_code travados' else 'FALTANDO' end as status
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'profiles_bloqueia_confianca';

-- B4) C3a — políticas novas de leads e messages ------------------------------
select 'B4. C3a ' || tablename || ' / ' || policyname as checagem,
       case
         when tablename = 'leads'    and with_check like '%properties%'       then 'OK — exige dono real de imóvel ativo'
         when tablename = 'messages' and with_check like '%tem_relacao_pedido_com%' then 'OK — exige relação entre as partes'
         else 'VULNERÁVEL — política antiga'
       end as status
from pg_policies
where schemaname = 'public'
  and ((tablename = 'leads' and policyname = 'inquilino cria lead')
    or (tablename = 'messages' and policyname = 'enviar mensagem'));

-- B4b (0054)
select 'B4b. C3a resposta (d) no mesmo imóvel (0054)' as checagem,
       -- o Postgres reescreve "is not distinct from" como "NOT (... IS DISTINCT FROM ...)"
       case when with_check ilike '%m.property_id IS DISTINCT FROM messages.property_id%'
            then 'OK — exige o mesmo imóvel' else 'FALTANDO — (d) sem limite de imóvel' end as status
from pg_policies
where schemaname = 'public' and tablename = 'messages' and policyname = 'enviar mensagem';

-- B5) C4a — property_private_details existe e volta VAZIA para um estranho ----
select 'B5. C4a RPC existe' as checagem,
       case when count(*) > 0 then 'OK — presente' else 'FALTANDO' end as status
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'property_private_details';

begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
                    json_build_object('sub', gen_random_uuid()::text, 'role', 'authenticated')::text,
                    true);
  select 'B5b. C4a RPC p/ quem não é dono nem aceito' as checagem,
         case when count(*) = 0 then 'OK — 0 linhas' else 'VULNERÁVEL — devolveu dados' end as status
  from public.property_private_details(
    (select id from public.properties where status = 'active' limit 1)
  );
rollback;

-- B6) draft_data em anúncios ATIVOS (deve ser 0) -----------------------------
select 'B6. draft_data em anúncios ativos' as checagem, count(*) as linhas
from public.properties where status = 'active' and draft_data is not null;

-- B7) PJ1 — contas ANTIGAS com PF/PJ divergente (a 0052 só corrige cadastros
--     novos). Ajuste manual se for o caso:
--     update profiles set person_type = 'pj' where id = '<uuid>';
select 'B7. PJ1 person_type divergente' as checagem,
       u.email, p.person_type as gravado,
       u.raw_user_meta_data ->> 'person_type' as escolhido_no_cadastro
from public.profiles p join auth.users u on u.id = p.id
where coalesce(u.raw_user_meta_data ->> 'person_type', 'pf') <> p.person_type::text
order by u.email;

-- B8) (0054) Indicação — cadastro grava referred_by e todo perfil ativo tem código ---
select 'B8. IND handle_new_user grava referred_by' as checagem,
       case when pg_get_functiondef(p.oid) like '%referred_by%'
            then 'OK — grava' else 'FALTANDO — código descartado (0054 não aplicada)' end as status
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_user';

select 'B8b. IND perfis ativos sem referral_code' as checagem, count(*) as linhas
from public.profiles where referral_code is null and anonymized_at is null;

-- B8c) Cadastros ANTIGOS que digitaram um código VÁLIDO de outra pessoa
--      (descartado na época). A 0054 NÃO preenche esses — decida caso a caso. Para gravar um:
--      update profiles set referred_by = '<uuid de quem indicou>' where id = '<uuid>';
select 'B8c. IND código digitado e descartado' as checagem,
       u.email, u.raw_user_meta_data ->> 'referred_by' as codigo_digitado,
       ind.email as quem_indicou
from public.profiles p
join auth.users u on u.id = p.id
join public.profiles ind
  on ind.referral_code in (upper(trim(u.raw_user_meta_data ->> 'referred_by')),
                           'VIVA-' || upper(trim(u.raw_user_meta_data ->> 'referred_by')))
 and ind.id <> p.id
where p.referred_by is null
  and coalesce(trim(u.raw_user_meta_data ->> 'referred_by'), '') <> ''
order by u.email;


-- ████ C — DEPOIS DA 0053 ████████████████████████████████████████████████████

-- C1) C3b — RPCs de contato: rode de novo a A2. Esperado: (ninguém) em todas.

-- C2) C4b — nenhuma coluna sensível de properties legível por anon/authenticated
select 'C2. C4b SELECT de coluna sensível' as checagem,
       case when count(*) = 0 then 'OK — nenhuma'
            else 'VULNERÁVEL — ' || string_agg(grantee || '.' || column_name, ', ') end as status
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'properties'
  and grantee in ('authenticated', 'anon') and privilege_type = 'SELECT'
  and column_name in ('exact_address', 'responsavel_local_nome', 'responsavel_local_telefone',
                      'responsavel_local_email', 'responsavel_local_user_id', 'draft_data',
                      'sublease_doc_url');

-- C3) C4b — as colunas públicas continuam legíveis (senão o site some)
select 'C3. C4b colunas públicas' as checagem,
       case when count(distinct column_name) >= 50 then 'OK — ' || count(distinct column_name) || ' colunas'
            else 'ATENÇÃO — só ' || count(distinct column_name) || ' colunas liberadas' end as status
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'properties'
  and grantee = 'anon' and privilege_type = 'SELECT';

-- C4) draft_data: rode de novo a B6. Esperado: 0.


-- ████ D — LIMPEZA (só depois de alguns dias sem problema) ███████████████████
-- A tabela abaixo guarda o draft_data (com a rua) que a 0052/0053 tiraram dos
-- anúncios ativos, só para o rollback. Quando não precisar mais de rollback:
--   drop table if exists public._backup_p0_draft_data;
select 'D. backup do draft_data' as checagem, migracao, count(*) as linhas
from public._backup_p0_draft_data group by migracao;
