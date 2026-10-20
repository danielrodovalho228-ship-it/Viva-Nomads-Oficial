-- Viva Nomads — aplicar 0136 (caixa de e-mails de teste). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0136_rollback.sql.
begin;
set local lock_timeout = '5s';

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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261016000136', '0136_emails_teste',
       array['-- conteúdo em supabase/migrations/0136_emails_teste.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000136');
commit;
