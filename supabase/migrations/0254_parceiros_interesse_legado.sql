-- 0254 — E227-B: parceria tem UMA fila (parceiro_solicitacoes, 0190). parceiros_interesse (0104) vira legado SÓ DE
-- LEITURA para anon/authenticated: sem insert, update ou delete pela API. A tabela NÃO sai — a política de retenção
-- (src/config/retencao.ts) e a exclusão de conta continuam tratando as linhas antigas pelo service_role.
revoke insert, update, delete on public.parceiros_interesse from anon, authenticated;
comment on table public.parceiros_interesse is 'Legado — fonte única: parceiro_solicitacoes (0190). Sai pela política de retenção.';
