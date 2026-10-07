-- 0083 — Pacote do Otávio (07/10/2026). Sem NOTICE; reaplicar é seguro.
-- Teste: tests/e2e/specs/t22-pacote-otavio.spec.ts (fala direto com o PostgREST).

-- 1) #29 + #25 — pedidos_publicos_lista() é SECURITY DEFINER e anon podia executar.
--    Só quem está logado usa (getPedidosParaProprietario e responderPedido, em
--    src/lib/data/pedidos-actions.ts); a função já devolve só colunas sem dado
--    pessoal. Então: anon não executa a função nem lê a view. Logado segue igual.
revoke execute on function public.pedidos_publicos_lista() from anon, public;
revoke select on public.pedidos_publicos from anon;
