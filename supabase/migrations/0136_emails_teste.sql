-- 0136 — Caixa de e-mails de teste (ordem 7436a29a, item 4).
-- Todo e-mail transacional enviado a uma conta de teste (profiles.is_teste, 0135) fica guardado aqui
-- (assunto, texto puro, destinatário MASCARADO) para o QA ler em /admin/emails-teste.
-- Só o servidor (service role) grava; só o admin lê (RLS).
create table if not exists public.emails_teste (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  evento text not null default '',
  assunto text not null default '',
  corpo text not null default '',
  destinatario_mascarado text not null default '',
  usuario_id uuid references public.profiles(id) on delete set null
);

create index if not exists emails_teste_criado_em_idx on public.emails_teste (criado_em desc);

alter table public.emails_teste enable row level security;

drop policy if exists emails_teste_admin_le on public.emails_teste;
create policy emails_teste_admin_le on public.emails_teste
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
