-- Rollback da 0184: volta a visibilidade da 0160, a compatibilidade da 0065, a validade da 0063 e a moderação da 0062.
-- Os pedidos excluídos voltam como "expirado" (o status 'excluido' deixa de existir). As colunas novas saem.
begin;
drop trigger if exists trg_pedido_atendido_no_contrato on public.contratos;
drop function if exists public.pedido_atendido_no_contrato();
drop table if exists public.pedidos_ignorados;
drop function if exists public.pedidos_mural();
create or replace function public.pedidos_publicos_lista()
returns table (
  id uuid,
  cidade text,
  uf text,
  data_inicio date,
  prazo_meses integer,
  orcamento_mensal numeric(12, 2),
  qtd_ocupantes integer,
  motivo text,
  apresentacao text,
  status text,
  criado_em timestamptz,
  expira_em timestamptz,
  inquilino_verificado boolean,
  pets boolean,
  criancas boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.cidade, p.uf, p.data_inicio, p.prazo_meses, p.orcamento_mensal, p.qtd_ocupantes,
         p.motivo, p.apresentacao, p.status, p.criado_em, p.expira_em,
         coalesce(pf.verification_progress, 0) >= 100,
         p.pets, p.criancas
    from public.pedidos_moradia p
    join public.profiles pf on pf.id = p.inquilino_id
    join auth.users u on u.id = p.inquilino_id
    join public.telefone_verificacao tv on tv.user_id = p.inquilino_id
   where p.status = 'ativo' and p.expira_em > now()
     and u.email_confirmed_at is not null
     and u.phone_confirmed_at is not null
     and tv.verificado_em is not null
$$;
revoke all on function public.pedidos_publicos_lista() from public, anon;
grant execute on function public.pedidos_publicos_lista() to authenticated, service_role;
drop function if exists public.pedido_visivel_para_donos(uuid, timestamptz);
drop function if exists public.leitor_com_email_confirmado();
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
create or replace function public.set_pedido_expira_em()
returns trigger
language plpgsql
as $trg$
begin
  if new.expira_em is null then
    new.expira_em := least(
      ((new.data_inicio + 15)::timestamp + time '23:59:59') at time zone 'America/Sao_Paulo',
      coalesce(new.criado_em, now()) + interval '60 days'
    );
  end if;
  return new;
end
$trg$;
drop trigger if exists trg_pedido_expira on public.pedidos_moradia;
create trigger trg_pedido_expira before insert on public.pedidos_moradia
  for each row execute function public.set_pedido_expira_em();
drop function if exists public.pedido_expira_calculado(date, timestamptz);
create or replace function public.pedido_moderacao_protegida()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') or public.is_admin() then
    return new;
  end if;
  if old.status = 'removido_admin' and new.status is distinct from old.status then
    raise exception 'Pedido removido pela moderação.' using errcode = '42501';
  end if;
  if new.status = 'removido_admin' and old.status is distinct from 'removido_admin' then
    raise exception 'Só a moderação remove pedidos.' using errcode = '42501';
  end if;
  return new;
end;
$$;
update public.pedidos_moradia set status = 'expirado' where status = 'excluido';
alter table public.pedidos_moradia drop constraint if exists pedidos_moradia_status_check;
alter table public.pedidos_moradia add constraint pedidos_moradia_status_check
  check (status in ('ativo', 'pausado', 'atendido', 'expirado', 'removido_admin'));
alter table public.pedidos_moradia
  drop constraint if exists pedidos_moradia_bairros_max3,
  drop constraint if exists pedidos_moradia_quartos_min_check,
  drop constraint if exists pedidos_moradia_faixa_valor,
  drop constraint if exists pedidos_moradia_necessidades_check,
  drop constraint if exists pedidos_moradia_porte_pet_check,
  drop column if exists bairros,
  drop column if exists quartos_min,
  drop column if exists orcamento_min,
  drop column if exists necessidades,
  drop column if exists porte_pet,
  drop column if exists renovado_em,
  drop column if exists excluido_em,
  drop column if exists aviso_renovar_em,
  drop column if exists aviso_telefone_em;
drop table if exists public.chaves_plataforma;
delete from supabase_migrations.schema_migrations where version = '20261019000184';
commit;
