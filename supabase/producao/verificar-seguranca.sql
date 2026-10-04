-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO DE SEGURANÇA P0 — rode no SQL Editor do Supabase (produção) ANTES
-- e DEPOIS de aplicar a 0052. Só LEITURA: não muda nada.
--
-- Interpretação rápida:
--   ANTES: a maioria dos itens aparece como "VULNERÁVEL".
--   DEPOIS: todos devem aparecer como "OK".
-- ════════════════════════════════════════════════════════════════════════════

-- 1) QUEM É ADMIN HOJE (confira: deve ser só você, dtrodovalho40@gmail.com) ----
select '1. admins' as checagem, id, email, role
from public.profiles
where role = 'admin'
order by email;

-- 2) C1 — handle_new_user NÃO pode aceitar 'admin' ----------------------------
select '2. C1 handle_new_user' as checagem,
       case when pg_get_functiondef(p.oid) like '%''admin''%'
            then 'VULNERÁVEL — ainda cita admin no allowlist'
            else 'OK — só owner|tenant' end as status
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_user';

-- 3) C2 — trigger que bloqueia colunas de confiança em profiles ---------------
select '3. C2 trigger profiles' as checagem,
       case when count(*) > 0 then 'OK — trigger presente'
            else 'VULNERÁVEL — sem trigger de bloqueio' end as status
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and tgname = 'trg_profiles_bloqueia_confianca'
  and not tgisinternal;

-- 3b) C2 — authenticated NÃO deve ter UPDATE em colunas de confiança ----------
select '3b. C2 grants de update sensíveis' as checagem,
       coalesce(string_agg(column_name, ', '), '(nenhuma)') as colunas_ainda_com_update
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
  and column_name in ('role','email','is_verified','verification_progress',
                      'fundador','fundador_em','account_type','cpf','anonymized_at');
-- Esperado DEPOIS: (nenhuma).

-- 4) C3 — RPCs de contato SEM execute para authenticated/anon -----------------
select '4. C3 execute de RPC de PII' as checagem,
       p.proname as rpc,
       coalesce(string_agg(distinct g.grantee, ', '), '(ninguém)') as quem_pode_executar
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join information_schema.role_routine_grants g
  on g.specific_schema = n.nspname
 and g.routine_name = p.proname
 and g.grantee in ('authenticated','anon')
 and g.privilege_type = 'EXECUTE'
where n.nspname = 'public'
  and p.proname in ('owner_notify_contact','message_notify_contact',
                    'pedido_owner_recipients','pedido_inquilino_recipient')
group by p.proname
order by p.proname;
-- Esperado DEPOIS: quem_pode_executar = (ninguém) em todas.

-- 5) C4 — anon/authenticated NÃO leem colunas sensíveis de properties ---------
select '5. C4 SELECT de coluna sensível' as checagem,
       grantee, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'properties'
  and grantee in ('authenticated','anon') and privilege_type = 'SELECT'
  and column_name in ('exact_address','responsavel_local_nome',
                      'responsavel_local_telefone','responsavel_local_email',
                      'responsavel_local_user_id','draft_data','sublease_doc_url')
order by grantee, column_name;
-- Esperado DEPOIS: 0 linhas (nenhum SELECT nessas colunas).

-- 6) C4 — nenhuma linha ATIVA ainda guarda draft_data (a rua) -----------------
select '6. C4 draft_data em anúncios ativos' as checagem,
       count(*) as linhas_ativas_com_draft
from public.properties
where status = 'active' and draft_data is not null;
-- Esperado DEPOIS: 0.

-- 7) C4 — a RPC de detalhes privados existe -----------------------------------
select '7. C4 property_private_details' as checagem,
       case when count(*) > 0 then 'OK — RPC presente' else 'FALTANDO' end as status
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'property_private_details';

-- 8) PJ1 — escolha PF/PJ do cadastro x o que ficou gravado ---------------------
-- A 0052 só corrige cadastros NOVOS. Linhas com divergência abaixo são contas
-- antigas que escolheram PJ e ficaram 'pf' — ajuste manual (service role) se for
-- o caso, ex.: update profiles set person_type='pj' where id='<uuid>';
select '8. PJ1 person_type divergente' as checagem,
       u.email, p.person_type as gravado,
       u.raw_user_meta_data ->> 'person_type' as escolhido_no_cadastro
from public.profiles p
join auth.users u on u.id = p.id
where coalesce(u.raw_user_meta_data ->> 'person_type', 'pf') <> p.person_type::text
order by u.email;
-- Esperado: só contas antigas (criadas antes da 0052). Contas novas não aparecem.

-- 9) C4 — property_private_details para quem NÃO é dono nem tem aceite --------
-- Simula um usuário logado qualquer (uuid aleatório) e chama a RPC num anúncio
-- ativo real. Tudo dentro de uma transação desfeita no fim (não muda nada).
-- Esperado DEPOIS: 0 linhas.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
                    json_build_object('sub', gen_random_uuid()::text,
                                      'role', 'authenticated')::text, true);
  select '9. C4 RPC privada p/ estranho' as checagem, count(*) as linhas_devolvidas
  from public.property_private_details(
    (select id from public.properties where status = 'active' limit 1)
  );
rollback;
