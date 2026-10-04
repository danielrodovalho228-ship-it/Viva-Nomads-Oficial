-- ─────────────────────────────────────────────────────────────────────────────
-- 0065 — correções da revisão da 0063 e da 0064. Idempotente; roda DEPOIS delas.
--
-- 0063 (contratos):
--  1. Aceite das duas partes só é exigido quando o bloco SAI de
--     'pendente_aceite' (ou nasce já vigente). Blocos antigos 'agendado' não
--     travam mais o ciclo diário (avancar_ciclo_blocos abortava).
--  2. Tetos (≤ 180 dias, caução ≤ 3 aluguéis) só no INSERT ou quando mudam
--     início/fim/caução, ou um bloco 'nao_aceito' volta a contar — antes
--     qualquer UPDATE de contrato antigo (1–12 meses) dava erro.
--  3. Aceites simultâneos: com os dois aceites, o próprio banco promove o
--     bloco para 'agendado' (antes podia ficar pendente e caducar).
--  4. contratos_prazo_max_180 como NOT VALID (contrato antigo > 180 dias não
--     derruba a migração; vale para os novos).
--  5. Fundador marcado sem data recebe a data (senão perdia o Profissional).
-- 0064 (pedidos):
--  6. "Livre no período" confere a data de SAÍDA, não só a de entrada.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1–3. regras dos blocos ──────────────────────────────────────────────────
create or replace function public.contrato_blocos_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aluguel numeric;
  dias_total int;
  caucao_total numeric;
  muda_teto boolean;
begin
  -- 3. Os dois aceites registrados → agendado (resolve aceites simultâneos).
  if new.status = 'pendente_aceite'
     and new.aceite_proprietario_em is not null
     and new.aceite_inquilino_em is not null
  then
    new.status := 'agendado';
  end if;

  -- 1. Entrar em vigor sem os dois aceites: só barra quem SAI de
  --    'pendente_aceite' ou nasce vigente (além do 1º bloco).
  if coalesce(new.numero_bloco, 1) > 1
     and new.status in ('agendado', 'ativo')
     and (tg_op = 'INSERT' or old.status = 'pendente_aceite')
     and (new.aceite_proprietario_em is null or new.aceite_inquilino_em is null)
  then
    raise exception 'Renovação precisa do aceite do proprietário e do inquilino.' using errcode = '23514';
  end if;

  -- 2. Tetos só quando algo que pesa neles muda.
  muda_teto := tg_op = 'INSERT'
    or new.inicio is distinct from old.inicio
    or new.fim is distinct from old.fim
    or new.caucao is distinct from old.caucao
    or (old.status = 'nao_aceito' and new.status <> 'nao_aceito');
  if not muda_teto or new.status = 'nao_aceito' then
    return new;
  end if;

  select c.aluguel_mensal into aluguel from public.contratos c where c.id = new.contrato_id;
  select coalesce(sum(b.fim - b.inicio + 1), 0), coalesce(sum(b.caucao), 0)
    into dias_total, caucao_total
    from public.contrato_blocos b
   where b.contrato_id = new.contrato_id
     and b.status <> 'nao_aceito'
     and b.id is distinct from new.id;
  dias_total := dias_total + coalesce(new.fim - new.inicio + 1, 0);
  caucao_total := caucao_total + coalesce(new.caucao, 0);

  if dias_total > 180 then
    raise exception 'O contrato passaria de 180 dias. Para continuar, é preciso um novo contrato.' using errcode = '23514';
  end if;
  if aluguel is not null and aluguel > 0 and caucao_total > aluguel * 3 then
    raise exception 'A caução total do contrato não pode passar de 3 aluguéis (art. 38 §2º da Lei 8.245/91).' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_contrato_blocos_regras on public.contrato_blocos;
create trigger trg_contrato_blocos_regras
  before insert or update on public.contrato_blocos
  for each row execute function public.contrato_blocos_regras();

-- ── 4. teto do contrato-mãe só para os novos ────────────────────────────────
alter table public.contratos drop constraint if exists contratos_prazo_max_180;
alter table public.contratos add constraint contratos_prazo_max_180
  check (prazo_total_dias is null or prazo_total_dias <= 180) not valid;

-- ── 5. Fundador sem data ────────────────────────────────────────────────────
update public.profiles set fundador_em = now() where fundador and fundador_em is null;

-- ── 6. compatibilidade: livre até a SAÍDA ───────────────────────────────────
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
            -- Livre pelo PERÍODO TODO: até a data de SAÍDA (antes: só a entrada —
            -- imóvel livre até a semana que vem servia para 6 meses).
            and (im.available_until is null or im.available_until >= ped.saida)) as livre,
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

-- Conferência (rodar depois):
--   select convalidated from pg_constraint where conname = 'contratos_prazo_max_180';  -- false
--   select count(*) from public.profiles where fundador and fundador_em is null;       -- 0
