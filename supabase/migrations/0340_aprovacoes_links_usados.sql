-- 0340 — Links de aprovação de USO ÚNICO (ordem 12a8086d, item 4).
--   • O aviso do Moacir (e-mail/push) leva um link assinado de 72 h para /admin/agentes/aprovar.
--   • A tela grava aqui a assinatura do link na primeira abertura (admin logado, duas etapas): a chave primária
--     faz a segunda abertura falhar (23505) e o link reaproveitado é recusado.
--   • Sem dado pessoal: só a assinatura (HMAC truncado, 32 hex), quando venceu e quando foi usado. Nada de usuário, IP ou ronda.
--   • RLS ligada e nenhuma policy: só o servidor (service_role) lê e grava. Linhas de links vencidos não servem mais
--     e a própria tela apaga as vencidas (expira_em < agora).
-- Só cria coisas novas e é idempotente. Rollback: supabase/producao/rollback/0340_rollback.sql.

create table if not exists public.aprovacoes_links_usados (
  assinatura text primary key check (assinatura ~ '^[0-9a-f]{32}$'),
  expira_em timestamptz not null,
  usado_em timestamptz not null default now()
);

create index if not exists aprovacoes_links_usados_expira on public.aprovacoes_links_usados (expira_em);

comment on table public.aprovacoes_links_usados is
  'Links de aviso já abertos (uso único, 72 h). Só a assinatura; sem dado pessoal. Só o servidor acessa.';

alter table public.aprovacoes_links_usados enable row level security;
revoke all on public.aprovacoes_links_usados from public, anon, authenticated;
grant select, insert, delete on public.aprovacoes_links_usados to service_role;
