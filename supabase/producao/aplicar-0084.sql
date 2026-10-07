-- Viva Nomads — aplicar 0084 (pacote de segurança: itens 2, 4 e 6). Sem NOTICE.
-- Rollback: supabase/producao/rollback/0084_rollback.sql
begin;

-- 2) anon não executa is_admin, pode_ver_contrato, pedido_ativo e pedido_inquilino.
--    CUIDADO que a revisão achou: 27 políticas valem para TODOS os papéis (role public)
--    e chamam is_admin()/pedido_ativo(). Revogar direto derruba a vitrine: o Postgres
--    avalia todas as políticas da tabela e anon recebe "permission denied for function
--    is_admin" ao ler properties/property_photos. Então, ANTES, essas políticas passam a
--    valer só para authenticated. Para anon não muda nada: elas exigem auth.uid() ou
--    is_admin(), e anon não tem nenhum dos dois. Tabelas: account_type_audit,
--    chamado_eventos, chamado_macros, chamado_mensagens, chamados, contracts,
--    documentos_fiscais, gastos_marketing (4), guarantees, insurance_quotes, leads,
--    moderacao_log, payment_accounts, pedidos_moradia, profiles, properties,
--    property_photos, qualification_checklists, respostas_pedido (3), subscriptions,
--    tenant_verifications, transactions.
--    Leituras públicas seguem por políticas próprias sem essas funções ("imóveis ativos
--    são públicos", "fotos públicas", "amenidades públicas", "avaliações públicas").
--    Ficam PÚBLICAS de propósito (docs/seguranca.md): conferir_documento (página
--    /conferir) e pedidos_publicos_lista (mural; leitura de quem está logado — a 0083
--    tira o anon dela).
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
     where schemaname in ('public', 'storage')
       and roles = array['public']::name[]
       and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(is_admin|pode_ver_contrato|pedido_ativo|pedido_inquilino)\('
  loop
    execute format('alter policy %I on %I.%I to authenticated', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.pode_ver_contrato(uuid) from anon, public;
revoke execute on function public.pedido_ativo(uuid) from anon, public;
revoke execute on function public.pedido_inquilino(uuid) from anon, public;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.pode_ver_contrato(uuid) to authenticated, service_role;
grant execute on function public.pedido_ativo(uuid) to authenticated, service_role;
grant execute on function public.pedido_inquilino(uuid) to authenticated, service_role;

-- 4) pg_net fora do schema public (advisor "extension_in_public"). O pg_net não aceita
--    ALTER EXTENSION ... SET SCHEMA (não é relocável): apaga e recria em extensions.
--    As funções continuam em net.* (atendimento_tique chama net.http_get e confere
--    com to_regproc antes). Perde só o histórico de respostas (net._http_response).
--    Sem pg_net instalado (laboratório), não faz nada.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net' and extnamespace = 'public'::regnamespace) then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end;
$$;

-- 6) Central de Agentes: Rafael vira Conselheiro do Dono (comando); Bruno ganha SEO técnico
--    e o checklist de segurança noturno. Briefing acompanha (é o que a Central e o chat mostram).
update public.agentes
   set cargo = 'Conselheiro do Dono',
       rotina_texto = 'Domingos 20:47 Brasília',
       esquadrao = 'comando',
       briefing = 'Conselheiro do Dono. Todo domingo lê o trabalho da semana de todos os agentes e os números reais da Viva e entrega ao Daniel as 3 decisões da semana, os riscos, o que parar de fazer e a prioridade nº 1.'
 where slug = 'rafael';
update public.agentes
   set cargo = 'TI, QA, segurança e SEO técnico',
       briefing = 'TI, QA, segurança e SEO técnico. Toda noite varre site, banco, avisos de segurança e erros da Vercel, roda o checklist fixo de segurança (rotas com login, senhas, tentativas de login, RLS, dados pessoais) e o SEO técnico; manda achados para a fila de correções.'
 where slug = 'bruno';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000084', '0084_pacote_seguranca',
       array['-- conteúdo em supabase/migrations/0084_pacote_seguranca.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000084');
commit;

-- Conferência (esperado: 0, 0, extensions, true, comando, TI…)
select count(*) as anon_executa_funcao_interna from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in ('is_admin', 'pode_ver_contrato', 'pedido_ativo', 'pedido_inquilino')
   and has_function_privilege('anon', p.oid, 'EXECUTE');
select count(*) as politicas_public_com_funcao_interna from pg_policies
 where roles = array['public']::name[] and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(is_admin|pode_ver_contrato|pedido_ativo|pedido_inquilino)\(';
select extnamespace::regnamespace as schema_pg_net, to_regproc('net.http_get') is not null as net_http_get_ok from pg_extension where extname = 'pg_net';
select slug, cargo, esquadrao, rotina_texto from public.agentes where slug in ('rafael', 'bruno');
-- Vitrine para anon (tem que devolver número, não erro):
set role anon; select count(*) as imoveis_visiveis_anon from public.properties; reset role;
