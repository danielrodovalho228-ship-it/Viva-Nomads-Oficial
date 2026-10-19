-- 0189 — Laboratório verde: a política "dono gerencia seus ignorados" (0184) nasceu para o role public e chama
-- is_admin(), que o anon não executa (0084/2). O lab noturno barrava em "política(s) de role public chamam função
-- interna" e a suíte E2E nem rodava. Passa a valer só para quem está logado (a tabela já não dá nada ao anon).
-- Idempotente (alter policy). Rollback: supabase/producao/rollback/0189_rollback.sql.
alter policy "dono gerencia seus ignorados" on public.pedidos_ignorados to authenticated;
