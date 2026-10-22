-- 0208 — Pedido de Moradia com "internet medida a partir de" (Prompt 57, fase 2). Reaplicar é seguro.
--
--  1. pedidos_moradia.internet_min_mbps: 50, 100 ou 300 (download medido, os mesmos chips da busca); nulo = sem exigência.
--  2. compatibilidade_pedidos: nova regra fixa r13 — com internet_min_mbps, só entra imóvel com medição VÁLIDA do dono
--     (internet_medida_publica_lista, 0205) de download >= o pedido. Internet só informada pelo dono não conta.
--     O resto da função é o da 0202, sem mudança.

alter table public.pedidos_moradia add column if not exists internet_min_mbps integer;
alter table public.pedidos_moradia drop constraint if exists pedidos_moradia_internet_min_valida;
alter table public.pedidos_moradia add constraint pedidos_moradia_internet_min_valida
  check (internet_min_mbps is null or internet_min_mbps in (50, 100, 300));

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
                           and greatest(5, ceil(t.minutos / 5) * 5) <= (ped.destino ->> 'ate')::int)) as r12,
           -- Prompt 57 fase 2: "internet medida a partir de" — só com medição VÁLIDA do dono que alcança o valor
           -- (a mesma view da busca; internet só informada não conta).
           (ped.internet_min_mbps is null
             or exists (select 1 from public.internet_medida_publica_lista() m
                         where m.property_id = im.id and m.download_mbps >= ped.internet_min_mbps)) as r13
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
           (par.r3 and par.r7 and par.r8 and par.r9 and par.r10 and par.r11 and par.r12 and par.r13) as fixas
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
