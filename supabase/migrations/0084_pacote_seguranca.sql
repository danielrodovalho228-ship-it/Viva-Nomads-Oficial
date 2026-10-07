-- 0084 — Pacote de segurança (revisão do Moacir, 07/10/2026). Sem NOTICE; reaplicar é seguro.
-- Teste: tests/e2e/specs/t23-pacote-seguranca.spec.ts. Item 1 (escrita de anon) está na 0083.

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
