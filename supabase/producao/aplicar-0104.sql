-- Viva Nomads — aplicar 0104 (interesse de parceria: tabela, RLS só-insert para anon, admin lê).
-- PRECISA APROVAÇÃO DO DANIEL — não aplicado. Aplicada pela Action quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0104_rollback.sql (perde os contatos já recebidos).
begin;
set local lock_timeout = '5s';

create table if not exists public.parceiros_interesse (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('fotografo','empresa','gestor','servicos','seguros')),
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,11}$'),
  email text check (email is null or char_length(email) <= 200),
  site text check (site is null or (site ~ '^https://' and char_length(site) <= 300)),
  aceite_contato boolean not null check (aceite_contato),
  status text not null default 'novo' check (status in ('novo','contatado','arquivado')),
  criado_em timestamptz not null default now(),
  constraint parceiros_interesse_tem_contato check (whatsapp is not null or email is not null)
);
create index if not exists parceiros_interesse_recentes on public.parceiros_interesse (criado_em desc);

alter table public.parceiros_interesse enable row level security;
revoke all on public.parceiros_interesse from public, anon, authenticated;
grant insert (tipo, nome, cidade, uf, whatsapp, email, site, aceite_contato) on public.parceiros_interesse to anon, authenticated;
grant select, update on public.parceiros_interesse to authenticated;   -- só passa a política de admin
grant all on public.parceiros_interesse to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='parceiros_interesse' and policyname='parceiros_interesse: qualquer um envia') then
    create policy "parceiros_interesse: qualquer um envia" on public.parceiros_interesse for insert to anon, authenticated
      with check (aceite_contato and status = 'novo');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='parceiros_interesse' and policyname='parceiros_interesse: admin le') then
    create policy "parceiros_interesse: admin le" on public.parceiros_interesse for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='parceiros_interesse' and policyname='parceiros_interesse: admin atualiza') then
    create policy "parceiros_interesse: admin atualiza" on public.parceiros_interesse for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261011000104', '0104_parceiros_interesse',
       array['-- conteúdo em supabase/migrations/0104_parceiros_interesse.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261011000104');
commit;
