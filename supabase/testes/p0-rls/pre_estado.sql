-- Reprodução do ESTADO ATUAL de produção (antes do P0), só no que a 0052/0053 tocam.
\set ON_ERROR_STOP on

-- Papéis como no Supabase.
do $r$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
end $r$;
grant usage on schema public to anon, authenticated, service_role;

-- Privilégios padrão do Supabase: tudo que é criado em public fica acessível.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- auth mínimo.
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text,
                         raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create type user_role as enum ('owner', 'tenant', 'admin');
create type person_type as enum ('pf', 'pj');

-- profiles (0001 + alters).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, phone text,
  role user_role not null default 'tenant',
  verification_progress int not null default 0,
  created_at timestamptz default now(),
  person_type person_type default 'pf', cpf text, cnpj text, company_name text,
  needs_nfse boolean default false, referral_code text unique, referred_by uuid,
  linkedin_url text, professional_category text, avatar_url text, response_rate int,
  is_verified boolean not null default false,
  notif_email boolean not null default true, notif_whatsapp boolean not null default true,
  fundador boolean not null default false, fundador_em timestamptz,
  avatar_atualizado_em timestamptz, preferred_mode text,
  account_type text not null default 'individual', anonymized_at timestamptz
);

-- properties: colunas públicas + sensíveis.
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id),
  title text not null, description text, property_type text, city text not null,
  state text, address text, lat numeric, lng numeric, bedrooms int, bathrooms int,
  area_m2 numeric, min_period_days int not null default 30, monthly_price numeric not null default 0,
  utilities_mode text, utilities_estimate numeric, utilities_overage_margin numeric,
  prep_fee numeric, checkout_cleaning_enabled boolean, checkout_cleaning_fee numeric,
  issues_invoice boolean, accepts_insurance boolean, rating numeric, review_count int,
  status text not null default 'draft', ready_to_live_badge boolean, ready_to_live_score int,
  tag_home_office boolean, tag_work_located boolean, tag_condo_approved boolean,
  ownership_type text, sublease_authorized boolean, video_url text,
  created_at timestamptz default now(), faixas_aceitas text[], garantias_aceitas text[],
  google_places jsonb, parking_spots int, condo_fee numeric, descricao_gerada_por_ia boolean,
  available_from date, furnished boolean, pets_allowed boolean, smoking_allowed boolean,
  children_allowed boolean, max_guests int, available_until date, max_period_days int,
  checkin_after text, checkout_before text,
  -- sensíveis
  exact_address text, responsavel_local_nome text, responsavel_local_telefone text,
  responsavel_local_email text, responsavel_local_user_id uuid, draft_data jsonb,
  sublease_doc_url text
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id),
  owner_id uuid references public.profiles(id),
  tenant_id uuid references public.profiles(id),
  status text not null default 'new',
  created_at timestamptz default now(),
  accepted_at timestamptz, rejected_at timestamptz, reject_reason text, decided_by uuid,
  accepted_plan text, accepted_commission_rate numeric,
  unique (property_id, tenant_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text, sender_id uuid, receiver_id uuid,
  property_id uuid references public.properties(id), body text,
  created_at timestamptz default now()
);

create table public.pedidos_moradia (
  id uuid primary key default gen_random_uuid(),
  inquilino_id uuid not null references auth.users(id),
  cidade text not null, status text not null default 'ativo',
  criado_em timestamptz not null default now()
);
create table public.respostas_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_moradia(id),
  proprietario_id uuid not null references auth.users(id),
  imovel_id uuid not null references public.properties(id),
  mensagem text, status text not null default 'enviada',
  unique (pedido_id, imovel_id)
);

-- is_admin (0011).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- RLS (0001/0011/0017/0046/0027).
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.pedidos_moradia enable row level security;
alter table public.respostas_pedido enable row level security;

create policy "perfil próprio" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "admin lê perfis" on profiles for select using (public.is_admin());
create policy "imóveis ativos são públicos" on properties for select using (status = 'active' or owner_id = auth.uid());
create policy "dono gerencia seus imóveis" on properties for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "leads das partes" on leads for select using (owner_id = auth.uid() or tenant_id = auth.uid());
create policy "inquilino cria lead" on leads for insert with check (tenant_id = auth.uid());
create policy "dono decide candidatura" on leads for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "mensagens das partes" on messages for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "enviar mensagem" on messages for insert with check (sender_id = auth.uid());
create policy "inquilino gerencia seus pedidos" on pedidos_moradia for all
  using (inquilino_id = auth.uid() or public.is_admin()) with check (inquilino_id = auth.uid() or public.is_admin());
create policy "proprietario le suas respostas" on respostas_pedido for select using (
  proprietario_id = auth.uid() or public.is_admin()
  or exists (select 1 from pedidos_moradia p where p.id = respostas_pedido.pedido_id and p.inquilino_id = auth.uid()));
create policy "proprietario cria resposta" on respostas_pedido for insert with check (
  proprietario_id = auth.uid()
  and exists (select 1 from properties im where im.id = respostas_pedido.imovel_id and im.owner_id = auth.uid() and im.status = 'active')
  and exists (select 1 from pedidos_moradia p where p.id = respostas_pedido.pedido_id and p.status = 'ativo'));
create policy "partes atualizam resposta" on respostas_pedido for update using (
  proprietario_id = auth.uid() or public.is_admin()
  or exists (select 1 from pedidos_moradia p where p.id = respostas_pedido.pedido_id and p.inquilino_id = auth.uid()));

-- handle_new_user (0013) + trigger.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email,
    case when new.raw_user_meta_data ->> 'role' in ('owner', 'tenant', 'admin')
         then (new.raw_user_meta_data ->> 'role')::user_role else 'tenant'::user_role end)
  on conflict (id) do nothing;
  return new;
exception when others then raise warning 'handle_new_user: % (%):', sqlerrm, sqlstate; return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 4 RPCs de contato (0023/0024/0028), com os grants originais.
create or replace function public.owner_notify_contact(prop_id uuid)
returns table (full_name text, email text, phone text) language sql security definer set search_path = public as $$
  select pf.full_name, pf.email, pf.phone from properties pr join profiles pf on pf.id = pr.owner_id
  where pr.id = prop_id and pr.status = 'active' limit 1; $$;
revoke all on function public.owner_notify_contact(uuid) from public;
grant execute on function public.owner_notify_contact(uuid) to authenticated;

create or replace function public.message_notify_contact(target uuid)
returns table (full_name text, email text, phone text) language sql security definer set search_path = public as $$
  select pf.full_name, pf.email, pf.phone from profiles pf where pf.id = target and (
    exists (select 1 from leads l where (l.owner_id = target and l.tenant_id = auth.uid()) or (l.owner_id = auth.uid() and l.tenant_id = target))
    or exists (select 1 from messages m where (m.sender_id = target and m.receiver_id = auth.uid()) or (m.sender_id = auth.uid() and m.receiver_id = target)))
  limit 1; $$;
revoke all on function public.message_notify_contact(uuid) from public;
grant execute on function public.message_notify_contact(uuid) to authenticated;

create or replace function public.pedido_owner_recipients(cidade_alvo text)
returns table (owner_id uuid, full_name text, email text, phone text, notif_whatsapp boolean)
language sql security definer set search_path = public as $$
  select distinct pf.id, pf.full_name, pf.email, pf.phone, pf.notif_whatsapp
  from properties pr join profiles pf on pf.id = pr.owner_id
  where pr.status = 'active' and lower(pr.city) = lower(cidade_alvo) and pf.notif_email = true and pf.email is not null
  limit 200; $$;
revoke all on function public.pedido_owner_recipients(text) from public;
grant execute on function public.pedido_owner_recipients(text) to authenticated;

create or replace function public.pedido_inquilino_recipient(pedido uuid)
returns table (full_name text, email text, phone text, notif_whatsapp boolean)
language sql security definer set search_path = public as $$
  select pf.full_name, pf.email, pf.phone, pf.notif_whatsapp
  from pedidos_moradia p join profiles pf on pf.id = p.inquilino_id
  where p.id = pedido and pf.notif_email = true
    and exists (select 1 from respostas_pedido r where r.pedido_id = p.id and r.proprietario_id = auth.uid())
  limit 1; $$;
revoke all on function public.pedido_inquilino_recipient(uuid) from public;
grant execute on function public.pedido_inquilino_recipient(uuid) to authenticated;

-- anonimizar_conta (0049, simplificada): SECURITY DEFINER que muda e-mail/anonymized_at.
create or replace function public.anonimizar_conta(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set full_name = null, phone = null, cpf = null,
         email = 'removido+' || target || '@anonimizado.invalid', anonymized_at = now()
   where id = target;
end; $$;
revoke all on function public.anonimizar_conta(uuid) from public, anon, authenticated;
grant execute on function public.anonimizar_conta(uuid) to service_role;

-- Tabela de resultados do teste (escrita por qualquer papel).
create table public.resultado (ordem serial, fase text, caso text, esperado text, obtido text, ok boolean, detalhe text);
grant all on public.resultado to public;
grant all on sequence public.resultado_ordem_seq to public;

-- Executa um SQL como o papel atual; registra se passou ou falhou.
create or replace function public.t(fase text, caso text, esperado text, sql text) returns void
language plpgsql security invoker as $$
declare deu text; det text := null;
begin
  begin
    execute sql;
    deu := 'passa';
  exception when others then
    deu := 'falha'; det := sqlerrm;
  end;
  insert into public.resultado (fase, caso, esperado, obtido, ok, detalhe)
  values (fase, caso, esperado, deu, deu = esperado, det);
end; $$;
grant execute on function public.t(text, text, text, text) to public;

-- Confere um valor (como o papel atual).
create or replace function public.v(fase text, caso text, sql text, esperado text) returns void
language plpgsql security invoker as $$
declare r text; det text := null;
begin
  begin
    execute sql into r;
  exception when others then r := 'ERRO'; det := sqlerrm;
  end;
  insert into public.resultado (fase, caso, esperado, obtido, ok, detalhe)
  values (fase, caso, esperado, coalesce(r, '(nulo)'), coalesce(r, '(nulo)') = esperado, det);
end; $$;
grant execute on function public.v(text, text, text, text) to public;
