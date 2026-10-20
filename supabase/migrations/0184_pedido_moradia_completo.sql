-- 0184 — Pedido de moradia completo (Prompt 30).
--  1. Chave SMS_ATIVO (tabela chaves_plataforma, desligada): com ela desligada, o pedido chega aos donos com o e-mail
--     confirmado dos dois lados; ligada, volta a exigência da 0160 (telefone confirmado), com 7 dias de prazo para os
--     pedidos que já estavam publicados quando a chave foi ligada.
--  2. Validade: 30 dias depois de publicar ou renovar, e nunca antes da data de entrada (fim do dia, Brasília).
--  3. Campos novos: bairros (até 3; vazio = qualquer bairro), quartos mínimos, faixa de valor (mín–máx), necessidades e
--     porte do pet. A compatibilidade (compatibilidade_pedidos) passa a usar todos eles.
--  4. Excluir (status 'excluido': some para os donos, o histórico fica para a equipe) e "Ignorar" do dono
--     (pedidos_ignorados).
--  5. O pedido fecha como "atendido" quando um contrato da Viva do mesmo inquilino é assinado pelas duas partes.
-- Reaplicar é seguro (create or replace / if not exists).

-- ── 1. Chaves da plataforma ──────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.chaves_plataforma (
  chave text primary key,
  ligada boolean not null default false,
  ligada_em timestamptz,
  alterada_em timestamptz not null default now(),
  alterada_por uuid
);
alter table public.chaves_plataforma enable row level security;
revoke all on public.chaves_plataforma from anon, authenticated;
grant select, insert, update on public.chaves_plataforma to service_role;
insert into public.chaves_plataforma (chave, ligada) values ('SMS_ATIVO', false) on conflict (chave) do nothing;

-- ── 2. Colunas novas do pedido ───────────────────────────────────────────────────────────────────────────────────
alter table public.pedidos_moradia add column if not exists bairros text[] not null default '{}';
alter table public.pedidos_moradia add column if not exists quartos_min integer;
alter table public.pedidos_moradia add column if not exists orcamento_min numeric(12, 2);
alter table public.pedidos_moradia add column if not exists necessidades text[] not null default '{}';
alter table public.pedidos_moradia add column if not exists porte_pet text;
alter table public.pedidos_moradia add column if not exists renovado_em timestamptz;
alter table public.pedidos_moradia add column if not exists excluido_em timestamptz;
alter table public.pedidos_moradia add column if not exists aviso_renovar_em timestamptz;
alter table public.pedidos_moradia add column if not exists aviso_telefone_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_moradia_bairros_max3') then
    alter table public.pedidos_moradia add constraint pedidos_moradia_bairros_max3 check (cardinality(bairros) <= 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_moradia_quartos_min_check') then
    alter table public.pedidos_moradia add constraint pedidos_moradia_quartos_min_check check (quartos_min is null or quartos_min between 0 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_moradia_faixa_valor') then
    alter table public.pedidos_moradia add constraint pedidos_moradia_faixa_valor check (orcamento_min is null or (orcamento_min >= 0 and orcamento_min <= orcamento_mensal));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_moradia_necessidades_check') then
    alter table public.pedidos_moradia add constraint pedidos_moradia_necessidades_check
      check (necessidades <@ array['home_office', 'garagem', 'mobiliado_completo', 'aceita_dividir', 'acessibilidade']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_moradia_porte_pet_check') then
    alter table public.pedidos_moradia add constraint pedidos_moradia_porte_pet_check check (porte_pet is null or porte_pet in ('pequeno', 'medio', 'grande'));
  end if;
end $$;

-- Status 'excluido' (o inquilino excluiu; o histórico fica para a equipe).
alter table public.pedidos_moradia drop constraint if exists pedidos_moradia_status_check;
alter table public.pedidos_moradia add constraint pedidos_moradia_status_check
  check (status in ('ativo', 'pausado', 'atendido', 'expirado', 'removido_admin', 'excluido'));

-- Excluído não volta (só a equipe mexe), como o removido pela moderação.
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
  if old.status = 'excluido' and new.status is distinct from old.status then
    raise exception 'Pedido excluído.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ── 3. Validade: 30 dias depois de publicar/renovar, nunca antes da entrada ──────────────────────────────────────
create or replace function public.pedido_expira_calculado(p_data_inicio date, p_base timestamptz)
returns timestamptz
language sql
immutable
as $$
  select greatest(
    coalesce(p_base, now()) + interval '30 days',
    (p_data_inicio::timestamp + time '23:59:59') at time zone 'America/Sao_Paulo'
  );
$$;

create or replace function public.set_pedido_expira_em()
returns trigger
language plpgsql
as $trg$
begin
  if tg_op = 'INSERT' then
    new.expira_em := public.pedido_expira_calculado(new.data_inicio, coalesce(new.criado_em, now()));
  elsif new.renovado_em is distinct from old.renovado_em or new.data_inicio is distinct from old.data_inicio then
    new.expira_em := public.pedido_expira_calculado(new.data_inicio, coalesce(new.renovado_em, new.criado_em));
  end if;
  return new;
end
$trg$;
drop trigger if exists trg_pedido_expira on public.pedidos_moradia;
create trigger trg_pedido_expira before insert or update on public.pedidos_moradia
  for each row execute function public.set_pedido_expira_em();

-- Pedidos publicados: recalcula pela regra nova (entrada 01/03/2027 publicada em 18/10/2026 → não vence antes de 01/03/2027).
update public.pedidos_moradia
   set expira_em = public.pedido_expira_calculado(data_inicio, coalesce(renovado_em, criado_em))
 where status in ('ativo', 'pausado');
-- Os que tinham expirado pela regra antiga mas ainda estão no prazo novo voltam a ativo.
update public.pedidos_moradia
   set status = 'ativo'
 where status = 'expirado'
   and public.pedido_expira_calculado(data_inicio, coalesce(renovado_em, criado_em)) > now();
update public.pedidos_moradia
   set expira_em = public.pedido_expira_calculado(data_inicio, coalesce(renovado_em, criado_em))
 where status = 'ativo' and expira_em < public.pedido_expira_calculado(data_inicio, coalesce(renovado_em, criado_em));

-- ── 4. Quem os donos veem (chave SMS_ATIVO) ──────────────────────────────────────────────────────────────────────
-- Uma regra só, usada pela lista antiga (pedidos_publicos_lista) e pela nova (pedidos_mural).
create or replace function public.pedido_visivel_para_donos(p_inquilino uuid, p_criado_em timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from auth.users u where u.id = p_inquilino and u.email_confirmed_at is not null)
     and (
       not coalesce((select c.ligada from chaves_plataforma c where c.chave = 'SMS_ATIVO'), false)
       or (exists (select 1 from auth.users u
                    join telefone_verificacao tv on tv.user_id = u.id
                   where u.id = p_inquilino and u.phone_confirmed_at is not null and tv.verificado_em is not null))
       -- Já publicado quando a chave foi ligada: 7 dias para confirmar antes de sair do ar.
       or exists (select 1 from chaves_plataforma c
                   where c.chave = 'SMS_ATIVO' and c.ligada_em is not null
                     and p_criado_em < c.ligada_em and now() < c.ligada_em + interval '7 days')
     );
$$;
revoke all on function public.pedido_visivel_para_donos(uuid, timestamptz) from public, anon, authenticated;

-- E-mail confirmado "dos dois lados": quem lê (o dono) também precisa ter o e-mail confirmado. O servidor (service
-- role, sem auth.uid()) lê tudo.
create or replace function public.leitor_com_email_confirmado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
      or exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function public.leitor_com_email_confirmado() from public, anon, authenticated;

-- Lista antiga (mesmas colunas da 0160): só troca a regra de visibilidade.
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
   where p.status = 'ativo' and p.expira_em > now()
     and public.leitor_com_email_confirmado()
     and public.pedido_visivel_para_donos(p.inquilino_id, p.criado_em)
$$;
revoke all on function public.pedidos_publicos_lista() from public, anon;
grant execute on function public.pedidos_publicos_lista() to authenticated, service_role;

-- Mural dos donos (Prompt 30): os campos novos e os selos (e-mail, telefone). Nunca contato nem identidade.
create or replace function public.pedidos_mural()
returns table (
  id uuid,
  cidade text,
  uf text,
  data_inicio date,
  prazo_meses integer,
  orcamento_min numeric,
  orcamento_mensal numeric,
  qtd_ocupantes integer,
  motivo text,
  apresentacao text,
  criado_em timestamptz,
  renovado_em timestamptz,
  expira_em timestamptz,
  pets boolean,
  porte_pet text,
  criancas boolean,
  bairros text[],
  quartos_min integer,
  necessidades text[],
  email_confirmado boolean,
  telefone_confirmado boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.cidade, p.uf, p.data_inicio, p.prazo_meses, p.orcamento_min, p.orcamento_mensal, p.qtd_ocupantes,
         p.motivo, p.apresentacao, p.criado_em, p.renovado_em, p.expira_em, p.pets, p.porte_pet, p.criancas,
         p.bairros, p.quartos_min, p.necessidades,
         true,
         exists (select 1 from auth.users u join telefone_verificacao tv on tv.user_id = u.id
                  where u.id = p.inquilino_id and u.phone_confirmed_at is not null and tv.verificado_em is not null)
    from public.pedidos_moradia p
   where p.status = 'ativo' and p.expira_em > now()
     and public.leitor_com_email_confirmado()
     and public.pedido_visivel_para_donos(p.inquilino_id, p.criado_em)
$$;
revoke all on function public.pedidos_mural() from public, anon;
grant execute on function public.pedidos_mural() to authenticated, service_role;

-- ── 5. Compatibilidade com os campos novos ───────────────────────────────────────────────────────────────────────
-- Regras novas (todas "obrigatórias", como pets/crianças): quartos ≥ mínimo (estúdio = 0), bairro (quando o pedido
-- escolhe bairros), home office, garagem, mobiliado completo, acessibilidade, porte do pet ≤ porte aceito, e "quarto
-- privativo" só para quem aceita dividir. A faixa de valor usa o máximo como antes; o mínimo não tira ninguém.
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
            and ('aceita_dividir' = any (ped.necessidades) or coalesce(im.property_type, '') <> 'quarto')) as r11
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
           (par.r3 and par.r7 and par.r8 and par.r9 and par.r10 and par.r11) as fixas
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

-- ── 6. "Ignorar" do dono ─────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.pedidos_ignorados (
  pedido_id uuid not null references public.pedidos_moradia (id) on delete cascade,
  proprietario_id uuid not null references auth.users (id) on delete cascade,
  motivo text check (motivo is null or char_length(motivo) <= 200),
  criado_em timestamptz not null default now(),
  primary key (pedido_id, proprietario_id)
);
alter table public.pedidos_ignorados enable row level security;
drop policy if exists "dono gerencia seus ignorados" on public.pedidos_ignorados;
create policy "dono gerencia seus ignorados" on public.pedidos_ignorados
  for all using (proprietario_id = auth.uid() or public.is_admin())
  with check (proprietario_id = auth.uid());
revoke all on public.pedidos_ignorados from anon;
grant select, insert, delete on public.pedidos_ignorados to authenticated;

-- ── 7. Contrato da Viva assinado pelas duas partes → pedido "atendido" ──────────────────────────────────────────
create or replace function public.pedido_atendido_no_contrato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assinado_proprietario_em is not null and new.assinado_inquilino_em is not null
     and (tg_op = 'INSERT' or old.assinado_proprietario_em is null or old.assinado_inquilino_em is null) then
    update public.pedidos_moradia
       set status = 'atendido'
     where inquilino_id = new.tenant_id and status in ('ativo', 'pausado');
  end if;
  return new;
end;
$$;
revoke all on function public.pedido_atendido_no_contrato() from public, anon, authenticated;
drop trigger if exists trg_pedido_atendido_no_contrato on public.contratos;
create trigger trg_pedido_atendido_no_contrato after insert or update of assinado_proprietario_em, assinado_inquilino_em
  on public.contratos for each row execute function public.pedido_atendido_no_contrato();

-- Conferência (rodar depois):
--   select chave, ligada from public.chaves_plataforma;                                 -- SMS_ATIVO | f
--   select public.pedido_expira_calculado('2027-03-01', '2026-10-18');                   -- 2027-03-02 02:59:59+00
--   select count(*) from public.pedidos_moradia where status = 'ativo' and expira_em < now();  -- 0
