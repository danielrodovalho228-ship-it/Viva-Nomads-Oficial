-- DESTINO-PESSOAL-B — o "Outro local" de cada pessoa na busca pelo tempo até o trabalho.
-- • destinos_pessoais: o local que a pessoa logada achou pelo endereço (rótulo sem número, ponto com 3 casas). RLS: só
--   a própria pessoa lê, grava e apaga. NÃO há política para o admin: o endereço é dela.
-- • destinos_pessoais_agregado(): o que o admin vê — o centro de cada célula de ~300 m com 5 pessoas distintas ou
--   mais nos últimos 90 dias. Sem endereço, sem rótulo, sem quem. Só o servidor (service_role) executa.
-- • destinos_nao_achados: "Não achei meu local" (nome do lugar + cidade) na fila do admin. Só o servidor grava e lê.
-- As âncoras oficiais (destinos) não mudam.

create table if not exists public.destinos_pessoais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rotulo text not null check (char_length(btrim(rotulo)) between 2 and 80),
  lat double precision not null check (lat between -34 and 6),
  lng double precision not null check (lng between -75 and -28),
  criado_em timestamptz not null default now(),
  usado_em timestamptz not null default now(),
  -- 3 casas no máximo (~110 m): o ponto do local, nunca a porta.
  constraint destinos_pessoais_tres_casas check (lat = round(lat::numeric, 3)::double precision and lng = round(lng::numeric, 3)::double precision)
);
create unique index if not exists destinos_pessoais_ponto_uidx on public.destinos_pessoais (user_id, lat, lng);
create index if not exists destinos_pessoais_usado_idx on public.destinos_pessoais (usado_em desc);
alter table public.destinos_pessoais enable row level security;
drop policy if exists "destinos pessoais: só a pessoa" on public.destinos_pessoais;
create policy "destinos pessoais: só a pessoa" on public.destinos_pessoais for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.destinos_pessoais from anon, authenticated;
grant select, insert, delete on public.destinos_pessoais to authenticated;
grant update (rotulo, usado_em) on public.destinos_pessoais to authenticated;
comment on table public.destinos_pessoais is
  'DESTINO-PESSOAL-B: local pessoal (Outro local) da busca. Só a própria pessoa lê; o admin vê só o agregado.';

-- Grade de ~300 m: 0,0027° de latitude × 0,0029° de longitude (a mesma de src/lib/destinos/pessoal.ts).
create or replace function public.destinos_pessoais_agregado(p_dias int default 90, p_min int default 5)
returns table (celula text, lat double precision, lng double precision, pessoas int)
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select floor(d.lat / 0.0027)::bigint as i, floor(d.lng / 0.0029)::bigint as j, d.user_id
      from public.destinos_pessoais d
     where d.usado_em >= now() - make_interval(days => greatest(1, least(p_dias, 365)))
  )
  select c.i || ':' || c.j,
         round(((c.i + 0.5) * 0.0027)::numeric, 5)::double precision,
         round(((c.j + 0.5) * 0.0029)::numeric, 5)::double precision,
         count(distinct c.user_id)::int
    from c
   group by c.i, c.j
  having count(distinct c.user_id) >= greatest(5, p_min)
   order by 4 desc, 1;
$$;
revoke all on function public.destinos_pessoais_agregado(int, int) from public, anon, authenticated;
grant execute on function public.destinos_pessoais_agregado(int, int) to service_role;

create table if not exists public.destinos_nao_achados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users (id) on delete set null
);
create index if not exists destinos_nao_achados_abertos_idx on public.destinos_nao_achados (criado_em desc) where resolvido_em is null;
alter table public.destinos_nao_achados enable row level security;
revoke all on public.destinos_nao_achados from anon, authenticated;
comment on table public.destinos_nao_achados is
  'DESTINO-PESSOAL-B: pedidos "Não achei meu local" (nome do lugar + cidade) para o admin cadastrar a âncora.';
