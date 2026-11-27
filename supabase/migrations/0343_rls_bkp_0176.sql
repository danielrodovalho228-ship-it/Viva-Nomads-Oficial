-- 0343 (E872, decisão do Daniel em 13/11/2026): a tabela de backup public._bkp_0176_contratos_encerrados (criada pela
-- 0176, guarda os contratos de TESTE encerrados para o rollback dela) estava sem RLS. Ela fica PROTEGIDA: RLS ligado e
-- nenhuma política, então só o service_role e o dono do banco a leem; anon e authenticated seguem sem permissão.
-- A tabela NÃO é apagada, em hipótese nenhuma (nem aqui nem no rollback desta migração).

alter table if exists public._bkp_0176_contratos_encerrados enable row level security;
revoke all on table public._bkp_0176_contratos_encerrados from anon, authenticated;
