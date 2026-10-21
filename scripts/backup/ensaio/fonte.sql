-- Ensaio do pipeline de backup (CI do PR): um "Supabase de mentira" num Postgres 17 comum, com as tabelas que as 5
-- consultas-chave usam (mesmos nomes e colunas da produção) e dados FICTÍCIOS com marcas fáceis de procurar
-- (e-mail, CPF, telefone, TEXTO-EM-CLARO-ENSAIO). O ensaio prova que nenhuma dessas marcas aparece no "Drive"
-- (cifrado) nem no log, e que o banco restaurado tem tudo de volta.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end;
$$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists supabase_migrations;
create schema if not exists extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);

create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text, created_by text);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text,
  full_name text,
  cpf text,
  phone text,
  bio text,
  recebe_avisos_ceo boolean not null default false,
  recebe_alertas_operacionais boolean not null default false
);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
create table public.properties (id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users (id), title text, address text, monthly_price numeric);
create table public.property_photos (id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties (id) on delete cascade, url text);
create table public.leads (id uuid primary key default gen_random_uuid(), property_id uuid references public.properties (id), tenant_id uuid references auth.users (id), mensagem text);
create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  valor_mensal numeric
);
create table public.contratos (id uuid primary key default gen_random_uuid(), property_id uuid references public.properties (id), lead_id uuid references public.leads (id));
create table public.contrato_assinaturas (id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.contratos (id) on delete cascade, user_id uuid references auth.users (id), ip text);
create table public.contrato_blocos (id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.contratos (id) on delete cascade);
create table public.pagamentos_bloco (
  id uuid primary key default gen_random_uuid(),
  bloco_id uuid not null references public.contrato_blocos (id) on delete cascade,
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  valor numeric
);
create table public.conferencias (id uuid primary key default gen_random_uuid(), contrato_id uuid references public.contratos (id), tipo text);
create table public.conferencia_respostas (id uuid primary key default gen_random_uuid(), conferencia_id uuid not null references public.conferencias (id) on delete cascade, texto text);

alter table public.profiles enable row level security;
create policy profiles_dono_le on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

-- Dados fictícios (com as marcas que NUNCA podem aparecer em claro no Drive nem no log).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'maria.ensaio@exemplo.com'),
  ('00000000-0000-4000-8000-000000000002', 'joao.ensaio@exemplo.com'),
  ('00000000-0000-4000-8000-000000000003', 'admin.ensaio@exemplo.com');
insert into public.profiles (id, role, full_name, cpf, phone, bio, recebe_avisos_ceo) values
  ('00000000-0000-4000-8000-000000000001', 'tenant', 'Maria Ensaio da Silva', '123.456.789-09', '(62) 99999-1234', E'TEXTO-EM-CLARO-ENSAIO\tcom tab\ne quebra de linha', false),
  ('00000000-0000-4000-8000-000000000002', 'owner', 'João Ensaio', '987.654.321-00', '(11) 98888-7777', 'TEXTO-EM-CLARO-ENSAIO', false),
  ('00000000-0000-4000-8000-000000000003', 'admin', 'Admin Ensaio', null, null, null, true);
insert into public.properties (id, owner_id, title, address, monthly_price)
select gen_random_uuid(), '00000000-0000-4000-8000-000000000002', 'Imóvel mobiliado ' || g, 'Rua TEXTO-EM-CLARO-ENSAIO, ' || g, 2500 + g
  from generate_series(1, 30) g;
insert into public.property_photos (property_id, url)
select p.id, 'property-photos/' || p.id || '/foto-' || g || '.jpg' from public.properties p, generate_series(1, 3) g;
insert into public.leads (id, property_id, tenant_id, mensagem)
select '00000000-0000-4000-8000-0000000000a1', id, '00000000-0000-4000-8000-000000000001', 'Olá, TEXTO-EM-CLARO-ENSAIO' from public.properties limit 1;
insert into public.propostas (lead_id, property_id, valor_mensal)
select l.id, l.property_id, 2600 from public.leads l;
insert into public.contratos (id, property_id, lead_id)
select '00000000-0000-4000-8000-0000000000c1', l.property_id, l.id from public.leads l;
insert into public.contrato_assinaturas (contrato_id, user_id, ip) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', '203.0.113.7'),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000002', '203.0.113.8');
insert into public.contrato_blocos (id, contrato_id) values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1');
insert into public.pagamentos_bloco (bloco_id, contrato_id, valor) values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', 2600);
insert into public.conferencias (id, contrato_id, tipo) values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000c1', 'entrada');
insert into public.conferencia_respostas (conferencia_id, texto) values ('00000000-0000-4000-8000-0000000000f1', 'Sofá com mancha — TEXTO-EM-CLARO-ENSAIO');
insert into storage.buckets (id, name) values ('avatars', 'avatars'), ('property-photos', 'property-photos'), ('documentos', 'documentos');
