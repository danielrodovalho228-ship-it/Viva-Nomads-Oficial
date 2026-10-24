-- Viva Nomads — aplicar 0238 (PERTO-B: proximidades com distância calculada e curadoria). Idempotente. Rollback: supabase/producao/rollback/0238_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.property_proximities
  add column if not exists tipo text,
  add column if not exists origem text not null default 'manual',
  add column if not exists distancia_m integer,
  add column if not exists tempo_min numeric(6, 1),
  add column if not exists tempo_modo text,
  add column if not exists endereco text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists oculto boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'property_proximities_origem_chk') then
    alter table public.property_proximities add constraint property_proximities_origem_chk check (origem in ('osm', 'manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'property_proximities_tipo_chk') then
    alter table public.property_proximities add constraint property_proximities_tipo_chk
      check (tipo is null or tipo in ('hospital', 'farmacia', 'academia', 'universidade', 'escola', 'coworking', 'mercado', 'onibus'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'property_proximities_distancia_chk') then
    alter table public.property_proximities add constraint property_proximities_distancia_chk check (distancia_m is null or distancia_m between 0 and 50000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'property_proximities_tempo_chk') then
    alter table public.property_proximities add constraint property_proximities_tempo_chk
      check ((tempo_min is null and tempo_modo is null) or (tempo_min is not null and tempo_min >= 0 and tempo_modo is not null and tempo_modo in ('a_pe', 'carro')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'property_proximities_endereco_chk') then
    alter table public.property_proximities add constraint property_proximities_endereco_chk check (endereco is null or char_length(endereco) <= 200);
  end if;
end $$;
comment on column public.property_proximities.distancia_m is 'PERTO-B: distância CALCULADA (OSM ou endereço do lugar geocodificado). Nunca digitada pelo dono.';
comment on column public.property_proximities.oculto is 'PERTO-B: o dono escolheu "não mostrar" este lugar.';

create table if not exists public.proximidades_reportes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  tipo text,
  motivo text not null check (char_length(motivo) between 3 and 200),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists proximidades_reportes_abertos on public.proximidades_reportes (criado_em desc) where resolvido_em is null;
comment on table public.proximidades_reportes is 'PERTO-B: "Está errado" num lugar achado pelo OSM. O dono cria e lê os seus; o admin lê pelo servidor.';
alter table public.proximidades_reportes enable row level security;
revoke all on public.proximidades_reportes from anon, authenticated;
grant select, insert on public.proximidades_reportes to authenticated;
drop policy if exists proximidades_reportes_dono_le on public.proximidades_reportes;
create policy proximidades_reportes_dono_le on public.proximidades_reportes for select to authenticated using (autor_id = auth.uid());
drop policy if exists proximidades_reportes_dono_cria on public.proximidades_reportes;
create policy proximidades_reportes_dono_cria on public.proximidades_reportes for insert to authenticated
  with check (autor_id = auth.uid() and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

-- O CEP do anúncio para a busca automática na EDIÇÃO (o rascunho com o CEP é apagado ao publicar). Coluna PRIVADA:
-- properties tem SELECT por coluna (0053) e esta coluna não é concedida a anon/authenticated; só o servidor lê.
alter table public.properties add column if not exists cep_proximidades text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_cep_proximidades_chk') then
    alter table public.properties add constraint properties_cep_proximidades_chk check (cep_proximidades is null or cep_proximidades ~ '^[0-9]{8}$');
  end if;
end $$;
revoke select (cep_proximidades) on public.properties from anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261024000238', '0238_proximidades_curadoria',
       array['-- conteúdo em supabase/migrations/0238_proximidades_curadoria.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000238');
commit;
