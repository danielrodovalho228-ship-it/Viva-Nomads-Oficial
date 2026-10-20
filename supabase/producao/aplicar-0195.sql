-- Viva Nomads — aplicar 0195 (Prompt 37: busca pelo local de trabalho, com tempo de deslocamento).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel). Nenhum destino com coordenada é inserido.
-- Rollback: supabase/producao/rollback/0195_rollback.sql.
begin;
set local lock_timeout = '5s';

-- ── 1. Destinos ──────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.destinos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  nome text not null check (char_length(btrim(nome)) between 3 and 120),
  -- Nome curto para os textos ("~15 min de carro até o HC-UFU"); sem ele, vale o nome.
  rotulo_curto text check (rotulo_curto is null or char_length(btrim(rotulo_curto)) between 2 and 40),
  tipo text not null default 'outro' check (tipo in ('hospital', 'universidade', 'empresa', 'outro')),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  lat double precision not null check (lat between -34 and 6),
  lng double precision not null check (lng between -74 and -33),
  ativo boolean not null default false,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists destinos_ativo_cidade_idx on public.destinos (ativo, uf, cidade);

alter table public.destinos enable row level security;
revoke all on public.destinos from public, anon, authenticated;
grant select on public.destinos to anon, authenticated;
grant insert, update, delete on public.destinos to authenticated;
grant all on public.destinos to service_role;

drop policy if exists destinos_le_ativos on public.destinos;
create policy destinos_le_ativos on public.destinos for select to anon, authenticated using (ativo);
-- "to authenticated" (nunca o role public): is_admin() não é executável pelo anon (0084/2, 0189).
drop policy if exists destinos_admin_le on public.destinos;
create policy destinos_admin_le on public.destinos for select to authenticated using (public.is_admin());
drop policy if exists destinos_admin_insere on public.destinos;
create policy destinos_admin_insere on public.destinos for insert to authenticated with check (public.is_admin());
drop policy if exists destinos_admin_altera on public.destinos;
create policy destinos_admin_altera on public.destinos for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists destinos_admin_apaga on public.destinos;
create policy destinos_admin_apaga on public.destinos for delete to authenticated using (public.is_admin());

comment on table public.destinos is 'Destinos nomeados da busca pelo local de trabalho (Prompt 37). Cadastro só pelo admin, com o ponto conferido no mapa; leitura pública só dos ativos.';

-- ── 2. Cache dos tempos ──────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.tempos_deslocamento (
  property_id uuid not null references public.properties (id) on delete cascade,
  -- O id do destino cadastrado ("d:<uuid>") ou, para endereço digitado, o ponto arredondado a 3 casas ("p:-18.918,-48.262").
  destino_chave text not null check (char_length(destino_chave) between 3 and 64),
  modo text not null check (modo in ('carro', 'a_pe', 'bicicleta', 'onibus')),
  minutos integer not null check (minutos between 0 and 1440),
  metros integer not null check (metros between 0 and 1000000),
  calculado_em timestamptz not null default now(),
  primary key (property_id, destino_chave, modo)
);
create index if not exists tempos_deslocamento_destino_idx on public.tempos_deslocamento (destino_chave, modo, calculado_em);

alter table public.tempos_deslocamento enable row level security;
revoke all on public.tempos_deslocamento from public, anon, authenticated;
grant all on public.tempos_deslocamento to service_role;
-- Sem política para anon/authenticated: RLS ligada + nenhum grant = nenhum acesso do cliente.

comment on table public.tempos_deslocamento is 'Cache do tempo imóvel → destino (Prompt 37). Só o servidor lê e grava; a tela recebe só os minutos arredondados.';

create or replace function public.tempos_limpa_ao_mover_imovel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    delete from public.tempos_deslocamento where property_id = new.id;
  end if;
  return new;
end;
$fn$;
revoke all on function public.tempos_limpa_ao_mover_imovel() from public, anon, authenticated;

drop trigger if exists trg_tempos_limpa_ao_mover_imovel on public.properties;
create trigger trg_tempos_limpa_ao_mover_imovel
  after update of lat, lng on public.properties
  for each row execute function public.tempos_limpa_ao_mover_imovel();

-- ── 3. Local de trabalho no perfil (privado) ─────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists local_trabalho jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_local_trabalho_chk') then
    alter table public.profiles add constraint profiles_local_trabalho_chk
      check (local_trabalho is null or (jsonb_typeof(local_trabalho) = 'object' and pg_column_size(local_trabalho) <= 2048));
  end if;
end $$;
-- A pessoa grava só a própria linha (RLS "perfil próprio: atualiza" + grant por coluna, como a 0141).
grant update (local_trabalho) on public.profiles to authenticated;

-- ── 4. Destino no pedido de moradia ──────────────────────────────────────────────────────────────────────────────
alter table public.pedidos_moradia add column if not exists destino jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_moradia_destino_chk') then
    alter table public.pedidos_moradia add constraint pedidos_moradia_destino_chk
      check (destino is null or (jsonb_typeof(destino) = 'object' and pg_column_size(destino) <= 2048));
  end if;
end $$;

-- ── 5. Contagem de buscas por destino (só número) ────────────────────────────────────────────────────────────────
create table if not exists public.buscas_destino (
  destino_id uuid not null references public.destinos (id) on delete cascade,
  dia date not null,
  total integer not null default 0 check (total >= 0),
  primary key (destino_id, dia)
);
alter table public.buscas_destino enable row level security;
revoke all on public.buscas_destino from public, anon, authenticated;
grant select on public.buscas_destino to authenticated;
grant all on public.buscas_destino to service_role;
drop policy if exists buscas_destino_admin_le on public.buscas_destino;
create policy buscas_destino_admin_le on public.buscas_destino for select to authenticated using (public.is_admin());

create or replace function public.contar_busca_destino(p_destino uuid, p_dia date)
returns void
language sql
security definer
set search_path = public, pg_temp
as $fn$
  insert into public.buscas_destino (destino_id, dia, total)
  select d.id, p_dia, 1 from public.destinos d where d.id = p_destino and d.ativo
  on conflict (destino_id, dia) do update set total = public.buscas_destino.total + 1;
$fn$;
revoke all on function public.contar_busca_destino(uuid, date) from public, anon, authenticated;
grant execute on function public.contar_busca_destino(uuid, date) to service_role;

comment on table public.buscas_destino is 'Buscas por destino cadastrado, por dia (Prompt 37). Só a contagem: sem endereço digitado, sem quem buscou.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261020000195', '0195_destinos_tempo_deslocamento',
       array['-- conteúdo em supabase/migrations/0195_destinos_tempo_deslocamento.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261020000195');
commit;
