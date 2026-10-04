-- ─────────────────────────────────────────────────────────────────────────────
-- 0062 — fecha a brecha "qualquer conta vira ADMIN".
--
-- A política "perfil próprio" (FOR ALL, auth.uid() = id) deixava o usuário
-- APAGAR o próprio perfil e RECRIÁ-LO com role='admin' (o trigger que protege
-- o papel — 0052 — só olha UPDATE). Com isso a pessoa passava a ler todos os
-- perfis/documentos, aprovar documentos e publicar anúncios.
--
-- O site nunca cria nem apaga perfil pelo cliente do usuário:
--   • cadastro → trigger handle_new_user (SECURITY DEFINER) em auth.users;
--   • exclusão de conta → delete_user_account / anonimizar_conta (SECURITY DEFINER).
-- Então basta tirar INSERT/DELETE de anon e authenticated. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
revoke insert, delete on public.profiles from anon, authenticated;

-- Conferência (rodar depois; esperado false, false, false, false):
--   select has_table_privilege('authenticated','public.profiles','INSERT'),
--          has_table_privilege('authenticated','public.profiles','DELETE'),
--          has_table_privilege('anon','public.profiles','INSERT'),
--          has_table_privilege('anon','public.profiles','DELETE');
