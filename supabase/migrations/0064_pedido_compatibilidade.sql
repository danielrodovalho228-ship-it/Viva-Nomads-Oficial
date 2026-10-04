-- ─────────────────────────────────────────────────────────────────────────────
-- 0064 — Pedido de Moradia: compatibilidade REAL, avisos só a quem combina.
--
-- Antes: o e-mail de pedido ia para TODOS os donos da cidade
-- (pedido_owner_recipients) e a tela "Compatíveis" comparava o orçamento com o
-- imóvel mais barato e a capacidade com qualquer imóvel.
--
-- Agora uma função única (`compatibilidade_pedidos`), usada pelo e-mail, pela
-- tela e pelos testes, avalia cada PAR (pedido, imóvel). É COMPATÍVEL quando o
-- MESMO imóvel atende TODAS:
--   1. mesma cidade (chave_cidade) e UF;
--   2. anúncio ativo e documento DESTE imóvel aprovado;
--   3. max_guests ≥ ocupantes (nulo = não compatível);
--   4. aluguel + condomínio + consumo fixo ≤ orçamento × 1,10;
--   5. prazo (meses × 30) dentro de [mínimo, máximo] do anúncio;
--   6. livre na data de entrada e sem contrato/bloqueio no período;
--   7. pet/criança do pedido aceitos pelo anúncio;
--   8. faixa do pedido entre as faixas aceitas (lista vazia = todas).
-- "Quase": passa em 1, 2, 3, 7 e 8 e falha SÓ UMA entre 4–6, por pouco
-- (preço até +20%, prazo até 30 dias fora, entrada até 15 dias depois).
-- Nota 0–100: preço 40, folga de vagas 20, motivo↔comodidade 20, selo 10,
-- data 10.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pedidos_moradia
  add column if not exists pets boolean not null default false,
  add column if not exists criancas boolean not null default false,
  add column if not exists compativeis_ao_publicar int;

-- A visão pública ganha pets/crianças (colunas no fim — compatível).
create or replace view public.pedidos_publicos as
 select p.id,
    p.cidade,
    p.uf,
    p.data_inicio,
    p.prazo_meses,
    p.orcamento_mensal,
    p.qtd_ocupantes,
    p.motivo,
    p.apresentacao,
    p.status,
    p.criado_em,
    p.expira_em,
    coalesce(pf.verification_progress, 0) >= 100 as inquilino_verificado,
    p.pets,
    p.criancas
   from public.pedidos_moradia p
     join public.profiles pf on pf.id = p.inquilino_id
  where p.status = 'ativo' and p.expira_em > now();

-- ── Avaliação de cada par (pedido, imóvel) ──────────────────────────────────
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
  situacao text,          -- 'compativel' | 'quase' | 'demais'
  nota int,
  motivo text,            -- só em 'quase': o que falta ("R$ 250 acima do orçamento")
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
             or coalesce(pr.google_places, '[]'::jsonb) @> '[{"categoria":"universidade"}]' as perto_universidade
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
            and (im.available_until is null or im.available_until >= ped.data_inicio)) as livre,
           (im.available_from is null or im.available_from <= ped.data_inicio) as disponivel_na_entrada,
           ((not ped.pets or coalesce(im.pets_allowed, false))
            and (not ped.criancas or coalesce(im.children_allowed, false))) as r7,
           (coalesce(cardinality(im.faixas_aceitas), 0) = 0 or ped.faixa = any (im.faixas_aceitas)) as r8
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
           (par.livre and not par.disponivel_na_entrada and par.available_from - par.ent <= 15) as q6
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
           when f.r3 and f.r7 and f.r8 and f.r4 and f.r5 and f.r6 then 'compativel'
           when f.r3 and f.r7 and f.r8 and f.falhas = 1
                and ((not f.r4 and f.q4) or (not f.r5 and f.q5) or (not f.r6 and f.q6)) then 'quase'
           else 'demais'
         end,
         least(100,
           -- preço (40)
           case when f.orc <= 0 then 0
                when f.total <= f.orc then 40
                else greatest(0, 40 - round(40 * (f.total - f.orc) / (f.orc * 0.2)))::int end
           -- folga de vagas (20)
           + case when f.max_guests is null then 0
                  when f.max_guests - f.ocup >= 2 then 20
                  when f.max_guests - f.ocup = 1 then 15
                  when f.max_guests = f.ocup then 10
                  else 0 end
           -- motivo ↔ comodidade (20)
           + case
               when f.ped_motivo in ('trabalho_remoto', 'relocacao_corporativa')
                 then case when coalesce(f.tag_home_office, false) then 20 else 0 end
               when f.ped_motivo = 'tratamento_medico'
                 then case when f.perto_hospital then 20 else 0 end
               when f.ped_motivo = 'intercambio_pos'
                 then case when f.perto_universidade then 20 else 0 end
               else 10
             end
           -- selo (10) e data (10)
           + case when coalesce(f.ready_to_live_badge, false) then 10 else 0 end
           + case when f.disponivel_na_entrada then 10 else 0 end
         )::int,
         case
           when not (f.r3 and f.r7 and f.r8) or f.falhas <> 1 then null
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

-- ── Registro de avisos (só o servidor grava/lê) ─────────────────────────────
create table if not exists public.pedido_avisos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_moradia (id) on delete cascade,
  dono_id uuid not null references public.profiles (id) on delete cascade,
  imovel_id uuid references public.properties (id) on delete set null,
  nota int,
  canal text not null check (canal in ('email', 'resumo', 'nenhum')),
  enviado_em timestamptz,
  motivo_nao_envio text,
  criado_em timestamptz not null default now(),
  unique (pedido_id, dono_id)          -- 1 aviso por pedido por dono
);
create index if not exists pedido_avisos_dono_idx on public.pedido_avisos (dono_id, enviado_em);
alter table public.pedido_avisos enable row level security;
revoke all on public.pedido_avisos from anon, authenticated;
grant all on public.pedido_avisos to service_role;

-- ── Números do admin ────────────────────────────────────────────────────────
create or replace function public.admin_metricas_pedidos(p_dias int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ped as (
    select * from pedidos_moradia where criado_em >= now() - make_interval(days => p_dias)
  ),
  av as (
    select a.*,
           (select min(r.criado_em) from respostas_pedido r
             where r.pedido_id = a.pedido_id and r.proprietario_id = a.dono_id) as respondido_em
      from pedido_avisos a
     where a.criado_em >= now() - make_interval(days => p_dias)
  )
  select jsonb_build_object(
    'dias', p_dias,
    'pedidos', (select count(*) from ped),
    'pedidos_com_compativel', (select count(*) from ped where coalesce(compativeis_ao_publicar, 0) > 0),
    'avisos_email', (select count(*) from av where canal = 'email' and enviado_em is not null),
    'avisos_resumo', (select count(*) from av where canal = 'resumo'),
    'avisos_respondidos', (select count(*) from av where respondido_em is not null),
    'horas_media_resposta', (select round(avg(extract(epoch from (respondido_em - coalesce(enviado_em, criado_em))) / 3600)::numeric, 1)
                               from av where respondido_em is not null)
  );
$$;
revoke all on function public.admin_metricas_pedidos(int) from public, anon, authenticated;
grant execute on function public.admin_metricas_pedidos(int) to service_role;

-- Conferência (rodar depois):
--   select count(*) from public.compatibilidade_pedidos();
--   select public.admin_metricas_pedidos(30);
