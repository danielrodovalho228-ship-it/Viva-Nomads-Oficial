-- Viva Nomads — aplicar 0202 (busca pelo local de trabalho — Prompt 37). Idempotente. Rollback: supabase/producao/rollback/0202_rollback.sql.
begin;
set local lock_timeout = '5s';
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 0202 — busca pelo local de trabalho (Prompt 37). Idempotente.
--
--  1. destinos: hospital, universidade ou empresa com ponto conferido pelo admin. Leitura pública só dos ativos; escrita
--     só do admin. Nenhuma coordenada vem do código: a lista inicial (HC-UFU e os dois campi da UFU) nasce INATIVA e
--     SEM ponto; o admin busca pelo nome, confere no mapa, salva e ativa.
--  2. tempos_deslocamento: cache dos tempos imóvel × destino × meio, calculados no servidor com o ponto EXATO do imóvel.
--     Nenhum acesso do cliente. Mudou o ponto do imóvel (ou do destino), as linhas dele somem.
--  3. profiles.local_trabalho (privado: a linha do perfil só é lida pela própria pessoa) e pedidos_moradia.destino
--     (o dono do imóvel recebe só o rótulo e os minutos, montados no servidor).
--  4. destinos_buscas_dia: só a contagem de buscas por destino e dia (cartão do admin), sem endereço nem quem buscou.
--  5. compatibilidade_pedidos: o "até N min" do pedido passa a ser regra obrigatória (tempo do cache).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- ── 1. Destinos ──────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.destinos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  artigo text not null default 'o' check (artigo in ('o', 'a', '')),
  tipo text not null check (tipo in ('hospital', 'universidade', 'empresa', 'outro')),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  lat double precision check (lat between -34 and 6),
  lng double precision check (lng between -75 and -28),
  ativo boolean not null default false,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint destinos_ativo_com_ponto check (not ativo or (lat is not null and lng is not null))
);
alter table public.destinos enable row level security;
drop policy if exists "destinos: leitura dos ativos" on public.destinos;
create policy "destinos: leitura dos ativos" on public.destinos for select using (ativo);
drop policy if exists "destinos: admin lê todos" on public.destinos;
create policy "destinos: admin lê todos" on public.destinos for select to authenticated using (public.is_admin());
drop policy if exists "destinos: admin grava" on public.destinos;
create policy "destinos: admin grava" on public.destinos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.destinos from anon, authenticated;
grant select on public.destinos to anon, authenticated;
grant insert, update, delete on public.destinos to authenticated;
create index if not exists destinos_criado_por_idx on public.destinos (criado_por);

insert into public.destinos (slug, nome, artigo, tipo, cidade, uf)
values ('hc-ufu', 'HC-UFU', 'o', 'hospital', 'Uberlândia', 'MG'),
       ('ufu-umuarama', 'UFU — Campus Umuarama', 'a', 'universidade', 'Uberlândia', 'MG'),
       ('ufu-santa-monica', 'UFU — Campus Santa Mônica', 'a', 'universidade', 'Uberlândia', 'MG')
on conflict (slug) do nothing;

-- ── 2. Cache dos tempos (só o servidor) ──────────────────────────────────────────────────────────────────────────
create table if not exists public.tempos_deslocamento (
  property_id uuid not null references public.properties (id) on delete cascade,
  -- "d:<id do destino>" ou "p:<lat>,<lng>" (endereço digitado, arredondado a 3 casas).
  destino_chave text not null check (destino_chave ~ '^(d:[0-9a-f-]{36}|p:-?[0-9]{1,2}\.[0-9]{3},-?[0-9]{1,3}\.[0-9]{3})$'),
  modo text not null check (modo in ('carro', 'a_pe', 'bicicleta', 'onibus')),
  -- null = o provedor não achou rota (ex.: ônibus sem linha) — o meio não aparece.
  minutos numeric(6, 1) check (minutos is null or minutos >= 0),
  metros integer check (metros is null or metros >= 0),
  calculado_em timestamptz not null default now(),
  primary key (property_id, destino_chave, modo)
);
alter table public.tempos_deslocamento enable row level security;
revoke all on public.tempos_deslocamento from anon, authenticated;
create index if not exists tempos_deslocamento_destino_idx on public.tempos_deslocamento (destino_chave, modo);

-- O ponto do imóvel mudou: os tempos dele valem para o ponto antigo. DEFINER porque quem edita o anúncio não tem acesso
-- ao cache (nem deve ter).
create or replace function public.tempos_limpa_imovel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lat_exata is distinct from old.lat_exata or new.lng_exata is distinct from old.lng_exata then
    delete from public.tempos_deslocamento where property_id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function public.tempos_limpa_imovel() from public, anon, authenticated;
drop trigger if exists trg_tempos_limpa_imovel on public.properties;
create trigger trg_tempos_limpa_imovel
  after update of lat, lng, lat_exata, lng_exata on public.properties
  for each row execute function public.tempos_limpa_imovel();

create or replace function public.tempos_limpa_destino()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    delete from public.tempos_deslocamento where destino_chave = 'd:' || old.id::text;
  end if;
  return null;
end;
$$;
revoke all on function public.tempos_limpa_destino() from public, anon, authenticated;
drop trigger if exists trg_tempos_limpa_destino on public.destinos;
create trigger trg_tempos_limpa_destino
  after update of lat, lng or delete on public.destinos
  for each row execute function public.tempos_limpa_destino();

-- ── 3. Local de trabalho (perfil e pedido) ───────────────────────────────────────────────────────────────────────
-- Formato: {destino_id?, rotulo, lat, lng, modo_preferido, ate?}. lat/lng do endereço digitado ficam no máximo com
-- 3 casas (o servidor arredonda); o rótulo nunca leva número de casa (regra do servidor).
create or replace function public.local_trabalho_valido(j jsonb)
returns boolean
language sql
immutable
as $$
  select j is null or (
    jsonb_typeof(j) = 'object'
    and char_length(coalesce(j ->> 'rotulo', '')) between 2 and 80
    and jsonb_typeof(j -> 'lat') = 'number' and (j ->> 'lat')::numeric between -34 and 6
    and jsonb_typeof(j -> 'lng') = 'number' and (j ->> 'lng')::numeric between -75 and -28
    and coalesce(j ->> 'modo_preferido', 'carro') in ('carro', 'a_pe', 'bicicleta', 'onibus')
    and (j -> 'destino_id' is null or (j ->> 'destino_id') ~ '^[0-9a-f-]{36}$')
    and (j -> 'ate' is null or (j ->> 'ate') in ('10', '15', '20', '30', '45'))
  );
$$;

alter table public.profiles add column if not exists local_trabalho jsonb;
alter table public.pedidos_moradia add column if not exists destino jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_local_trabalho_valido') then
    alter table public.profiles add constraint profiles_local_trabalho_valido check (public.local_trabalho_valido(local_trabalho));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_moradia_destino_valido') then
    alter table public.pedidos_moradia add constraint pedidos_moradia_destino_valido check (public.local_trabalho_valido(destino));
  end if;
end $$;
-- Perfil: gravado só pelo servidor (sem grant de update para o cliente, como os outros campos sensíveis).
revoke update (local_trabalho) on public.profiles from anon, authenticated;

-- Chave do cache a partir do destino gravado (mesma regra de chaveDestino em src/lib/rotas/tempo.ts).
create or replace function public.chave_destino(j jsonb)
returns text
language sql
immutable
as $$
  select case
    when j is null then null
    when (j ->> 'destino_id') is not null then 'd:' || (j ->> 'destino_id')
    else 'p:' || round((j ->> 'lat')::numeric, 3)::text || ',' || round((j ->> 'lng')::numeric, 3)::text
  end;
$$;

-- ── 4. Destinos mais buscados (só contagem) ──────────────────────────────────────────────────────────────────────
create table if not exists public.destinos_buscas_dia (
  destino_id uuid not null references public.destinos (id) on delete cascade,
  dia date not null,
  n integer not null default 0 check (n >= 0),
  primary key (destino_id, dia)
);
alter table public.destinos_buscas_dia enable row level security;
revoke all on public.destinos_buscas_dia from anon, authenticated;

create or replace function public.registrar_busca_destino(p_destino uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.destinos_buscas_dia (destino_id, dia, n)
  select p_destino, (now() at time zone 'America/Sao_Paulo')::date, 1
   where exists (select 1 from public.destinos d where d.id = p_destino and d.ativo)
  on conflict (destino_id, dia) do update set n = public.destinos_buscas_dia.n + 1;
$$;
revoke all on function public.registrar_busca_destino(uuid) from public, anon, authenticated;
grant execute on function public.registrar_busca_destino(uuid) to service_role;

-- ── 5. Compatibilidade com o "até N min" ─────────────────────────────────────────────────────────────────────────
-- A função inteira da 0184 com a regra r12: com destino e "até", só é compatível o imóvel com tempo do cache dentro
-- do limite (o cron e o envio do pedido calculam os tempos que faltam).
create or replace function public.compatibilidade_pedidos(
  p_pedido uuid default null,
  p_imovel uuid default null,
  p_dono uuid default null
)
returns table (
  pedido_id uuid,
  imovel_id uuid,
  dono_id uuid,
  titulo text,
  situacao text,
  nota int,
  motivo text,
  total_mensal numeric,
  orcamento numeric,
  vagas int,
  ocupantes int,
  prazo_dias int,
  min_dias int,
  max_dias int,
  entrada date,
  disponivel_desde date
)
language sql
stable
security definer
set search_path = public
as $$
  with ped as (
    select p.*,
           p.prazo_meses * 30 as dias,
           p.data_inicio + (p.prazo_meses * 30) - 1 as saida,
           case when p.prazo_meses * 30 < 90 then 'temporada' else 'media_estadia' end as faixa
      from pedidos_moradia p
     where p.status = 'ativo'
       and p.expira_em > now()
       and (p_pedido is null or p.id = p_pedido)
  ),
  im as (
    select pr.*,
           pr.monthly_price
             + coalesce(pr.condo_fee, 0)
             + case when pr.utilities_mode::text = 'fixed' then coalesce(pr.utilities_estimate, 0) else 0 end as total,
           coalesce(pr.min_period_days, 30) as min_d,
           coalesce(pr.max_period_days, 180) as max_d,
           exists (select 1 from property_proximities x
                    where x.property_id = pr.id
                      and (x.category ilike '%hosp%' or x.category ilike '%saud%' or x.category ilike '%saúd%'))
             or coalesce(pr.google_places, '[]'::jsonb) @> '[{"categoria":"hospital"}]' as perto_hospital,
           exists (select 1 from property_proximities x
                    where x.property_id = pr.id
                      and (x.category ilike '%univ%' or x.category ilike '%facul%'))
             or coalesce(pr.google_places, '[]'::jsonb) @> '[{"categoria":"universidade"}]' as perto_universidade,
           (coalesce(pr.tag_home_office, false)
             or exists (select 1 from property_amenities a where a.property_id = pr.id and a.label ilike 'home office%')) as tem_home_office,
           (coalesce(pr.parking_spots, 0) > 0
             or exists (select 1 from property_amenities a where a.property_id = pr.id and a.label ilike 'vaga de garagem%')) as tem_garagem,
           (coalesce(pr.furnished, false)
             or exists (select 1 from property_amenities a where a.property_id = pr.id and a.label ilike 'mobiliado completo%')) as tem_mobiliado,
           exists (select 1 from property_amenities a where a.property_id = pr.id and a.label ilike '%acessív%') as tem_acessibilidade,
           case coalesce(pr.pets_regras ->> 'porteMax', '')
             when 'P' then 1 when 'M' then 2 when 'G' then 3
             else case when coalesce(pr.pets_allowed, false) then 3 else 0 end
           end as porte_aceito
      from properties pr
     where pr.status = 'active'
       and (p_imovel is null or pr.id = p_imovel)
       and (p_dono is null or pr.owner_id = p_dono)
       and coalesce((select qc.document_status
                       from qualification_checklists qc
                      where qc.property_id = pr.id and qc.owner_id = pr.owner_id
                      order by qc.created_at desc
                      limit 1), 'none') = 'approved'
  ),
  par as (
    select ped.id as pid, ped.motivo as ped_motivo, ped.orcamento_mensal as orc, ped.qtd_ocupantes as ocup,
           ped.dias, ped.data_inicio as ent, ped.saida, im.*,
           (im.max_guests is not null and im.max_guests >= ped.qtd_ocupantes) as r3,
           (im.total <= ped.orcamento_mensal * 1.10) as r4,
           (ped.dias between im.min_d and im.max_d) as r5,
           (not exists (select 1 from contratos c join contrato_blocos b on b.contrato_id = c.id
                         where c.property_id = im.id and c.status = 'ativo'
                           and b.status in ('ativo', 'agendado')
                           and b.inicio <= ped.saida and b.fim >= ped.data_inicio)
            and not exists (select 1 from property_blocks pb
                             where pb.property_id = im.id
                               and pb.inicio <= ped.saida and pb.fim >= ped.data_inicio)
            and (im.available_until is null or im.available_until >= ped.saida)) as livre,
           (im.available_from is null or im.available_from <= ped.data_inicio) as disponivel_na_entrada,
           ((not ped.pets or coalesce(im.pets_allowed, false))
            and (not ped.criancas or coalesce(im.children_allowed, false))
            -- Porte do pet: pequeno=1, médio=2, grande=3; o anúncio aceita até o porte dele.
            and (not ped.pets or ped.porte_pet is null
                 or im.porte_aceito >= case ped.porte_pet when 'pequeno' then 1 when 'medio' then 2 else 3 end)) as r7,
           (coalesce(cardinality(im.faixas_aceitas), 0) = 0 or ped.faixa = any (im.faixas_aceitas)) as r8,
           -- Campos do Prompt 30.
           (ped.quartos_min is null or ped.quartos_min = 0 or coalesce(im.bedrooms, 0) >= ped.quartos_min) as r9,
           (cardinality(ped.bairros) = 0
             or exists (select 1 from unnest(ped.bairros) b
                         where position(chave_cidade(b) in chave_cidade(coalesce(im.address, ''))) > 0)) as r10,
           ((not 'home_office' = any (ped.necessidades) or im.tem_home_office)
            and (not 'garagem' = any (ped.necessidades) or im.tem_garagem)
            and (not 'mobiliado_completo' = any (ped.necessidades) or im.tem_mobiliado)
            and (not 'acessibilidade' = any (ped.necessidades) or im.tem_acessibilidade)
            and ('aceita_dividir' = any (ped.necessidades) or coalesce(im.property_type, '') <> 'quarto')) as r11,
           -- Prompt 37: "até N min" do local de trabalho (tempo do cache, arredondado como a tela mostra).
           (ped.destino is null or (ped.destino ->> 'ate') is null
             or exists (select 1 from tempos_deslocamento t
                         where t.property_id = im.id
                           and t.destino_chave = public.chave_destino(ped.destino)
                           and t.modo = coalesce(ped.destino ->> 'modo_preferido', 'carro')
                           and t.minutos is not null
                           and greatest(5, ceil(t.minutos / 5) * 5) <= (ped.destino ->> 'ate')::int)) as r12
      from ped
      join im
        on chave_cidade(im.city) = chave_cidade(ped.cidade)
       and (im.state is null or ped.uf is null or upper(im.state) = upper(ped.uf))
       and im.owner_id <> ped.inquilino_id
  ),
  aval as (
    select par.*,
           (par.livre and par.disponivel_na_entrada) as r6,
           (par.total > par.orc * 1.10 and par.total <= par.orc * 1.20) as q4,
           ((par.dias < par.min_d and par.min_d - par.dias <= 30)
             or (par.dias > par.max_d and par.dias - par.max_d <= 30)) as q5,
           (par.livre and not par.disponivel_na_entrada and par.available_from - par.ent <= 15) as q6,
           (par.r3 and par.r7 and par.r8 and par.r9 and par.r10 and par.r11 and par.r12) as fixas
      from par
  ),
  final as (
    select aval.*,
           (case when aval.r4 then 0 else 1 end
            + case when aval.r5 then 0 else 1 end
            + case when aval.r6 then 0 else 1 end) as falhas
      from aval
  )
  select f.pid,
         f.id,
         f.owner_id,
         f.title,
         case
           when f.fixas and f.r4 and f.r5 and f.r6 then 'compativel'
           when f.fixas and f.falhas = 1
                and ((not f.r4 and f.q4) or (not f.r5 and f.q5) or (not f.r6 and f.q6)) then 'quase'
           else 'demais'
         end,
         least(100,
           case when f.orc <= 0 then 0
                when f.total <= f.orc then 40
                else greatest(0, 40 - round(40 * (f.total - f.orc) / (f.orc * 0.2)))::int end
           + case when f.max_guests is null then 0
                  when f.max_guests - f.ocup >= 2 then 20
                  when f.max_guests - f.ocup = 1 then 15
                  when f.max_guests = f.ocup then 10
                  else 0 end
           + case
               when f.ped_motivo in ('trabalho_remoto', 'relocacao_corporativa')
                 then case when f.tem_home_office then 20 else 0 end
               when f.ped_motivo = 'tratamento_medico'
                 then case when f.perto_hospital then 20 else 0 end
               when f.ped_motivo = 'intercambio_pos'
                 then case when f.perto_universidade then 20 else 0 end
               else 10
             end
           + case when coalesce(f.ready_to_live_badge, false) then 10 else 0 end
           + case when f.disponivel_na_entrada then 10 else 0 end
         )::int,
         case
           when not f.fixas or f.falhas <> 1 then null
           when not f.r4 and f.q4 then
             'R$ ' || replace(to_char(round(f.total - f.orc), 'FM999,999,990'), ',', '.') || ' acima do orçamento'
           when not f.r5 and f.q5 and f.dias < f.min_d then
             'prazo ' || (f.min_d - f.dias) || ' dias abaixo do mínimo do anúncio'
           when not f.r5 and f.q5 then
             'prazo ' || (f.dias - f.max_d) || ' dias acima do máximo do anúncio'
           when not f.r6 and f.q6 then
             'começa ' || (f.available_from - f.ent) || ' dias depois'
         end,
         f.total,
         f.orc,
         f.max_guests,
         f.ocup,
         f.dias,
         f.min_d,
         f.max_d,
         f.ent,
         f.available_from
    from final f;
$$;
revoke all on function public.compatibilidade_pedidos(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.compatibilidade_pedidos(uuid, uuid, uuid) to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261021000202', '0202_local_de_trabalho',
       array['-- conteúdo em supabase/migrations/0202_local_de_trabalho.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261021000202');
commit;
