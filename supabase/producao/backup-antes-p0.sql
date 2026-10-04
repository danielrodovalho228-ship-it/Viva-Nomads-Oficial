-- ════════════════════════════════════════════════════════════════════════════
-- FOTOGRAFIA ANTES DO P0 — rode no SQL Editor ANTES da 0052 e salve a saída
-- (botão de exportar CSV de cada resultado). Só LEITURA.
--
-- Complementa o backup do painel (Database → Backups). Se o seu plano não tiver
-- backup automático, isto guarda pelo menos o que a 0052/0053 alteram:
-- definições de função, políticas e privilégios.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Definição completa das funções que o P0 recria ou restringe.
select p.proname as funcao, pg_get_functiondef(p.oid) as definicao
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('handle_new_user', 'is_admin', 'owner_notify_contact',
                    'message_notify_contact', 'pedido_owner_recipients',
                    'pedido_inquilino_recipient')
order by p.proname;

-- 2) Políticas (RLS) das tabelas que o P0 toca.
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename in ('profiles', 'properties', 'leads', 'messages')
order by tablename, policyname;

-- 3) Privilégios de TABELA de anon/authenticated nessas tabelas.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('profiles', 'properties', 'leads', 'messages')
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_name, grantee order by table_name, grantee;

-- 4) Privilégios de COLUNA existentes (normalmente vazio antes do P0).
select table_name, grantee, privilege_type, count(*) as colunas
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('profiles', 'properties')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee, privilege_type order by table_name, grantee, privilege_type;

-- 5) Execute das funções (quem pode chamar cada uma).
select routine_name, grantee
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name in ('handle_new_user', 'owner_notify_contact', 'message_notify_contact',
                       'pedido_owner_recipients', 'pedido_inquilino_recipient')
order by routine_name, grantee;

-- 6) Triggers em profiles.
select tgname, pg_get_triggerdef(oid) as definicao
from pg_trigger
where tgrelid = 'public.profiles'::regclass and not tgisinternal;
