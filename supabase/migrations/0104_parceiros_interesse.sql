-- 0104 — PARCEIROS: interesse de parceria (ordem a437a6d6, item 2). Tela pública /parceiros, formulário "Quero ser parceiro".
-- Por quê: hoje não há onde registrar quem quer ser parceiro (fotógrafo, empresa, serviços, seguros).
-- Segurança: anon só INSERE (colunas limitadas e aceite de contato obrigatório); só admin lê e atualiza o status.
-- Limite por IP é feito na rota (consumir_limite). Dados guardados: o que a própria pessoa informa para ser contatada. Idempotente.

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
