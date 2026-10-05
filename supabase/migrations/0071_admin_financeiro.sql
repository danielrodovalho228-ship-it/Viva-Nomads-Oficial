-- ─────────────────────────────────────────────────────────────────────────────
-- 0071 — /admin/financeiro (PR C). Idempotente.
--
-- Até aqui a assinatura só tinha o status ATUAL (sem data de início/fim) e o
-- webhook do Asaas não guardava o VALOR pago. Sem isso, churn, MRR no tempo e
-- receita recebida seriam chute. Esta migração cria a base, daqui para frente:
--
--  1. assinatura_eventos — histórico append-only de cada mudança de status ou
--     plano (gatilho em subscriptions). Recebe hoje uma "foto inicial" de cada
--     assinatura (origem 'inicio_historico'): antes dela, a tela mostra "—".
--  2. recebimentos — o que de fato ENTROU pelo Asaas (assinatura e comissão),
--     gravado pelo webhook com o valor. Um registro por pagamento.
--  3. admin_financeiro(início, fim, cidade) — agregados só para a equipe (mesma
--     trava da 0068/0069): assinaturas por plano no início/fim do período,
--     novas, saídas, receita recebida, comissões, marketing, série mensal.
--     Preço dos planos fica no código (config/planos.ts, fonte única): o banco
--     devolve CONTAGENS por plano; o MRR é calculado na tela.
-- Nada disso é legível pela API (RLS sem política + revoke).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 ──────────────────────────────────────────────────────────────────────────
create table if not exists public.assinatura_eventos (
  id bigint generated always as identity primary key,
  subscription_id uuid not null,
  owner_id uuid,
  plano text,
  status_de text,
  status_para text,
  origem text not null default 'gatilho' check (origem in ('gatilho', 'inicio_historico')),
  criado_em timestamptz not null default now()
);
create index if not exists assinatura_eventos_sub_idx on public.assinatura_eventos (subscription_id, criado_em);
create index if not exists assinatura_eventos_criado_idx on public.assinatura_eventos (criado_em);
alter table public.assinatura_eventos enable row level security;
revoke all on public.assinatura_eventos from anon, authenticated;
grant select, insert on public.assinatura_eventos to service_role;

create or replace function public.registra_assinatura_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or old.status is distinct from new.status
     or old.plan::text is distinct from new.plan::text
  then
    insert into public.assinatura_eventos (subscription_id, owner_id, plano, status_de, status_para)
    values (new.id, new.owner_id, new.plan::text,
            case when tg_op = 'INSERT' then null else old.status end, new.status);
  end if;
  return null;
end;
$$;
revoke execute on function public.registra_assinatura_evento() from public, anon, authenticated;
drop trigger if exists trg_assinatura_evento on public.subscriptions;
create trigger trg_assinatura_evento
  after insert or update of status, plan on public.subscriptions
  for each row execute function public.registra_assinatura_evento();

-- Foto inicial (uma vez): marca o começo do histórico.
insert into public.assinatura_eventos (subscription_id, owner_id, plano, status_de, status_para, origem)
select s.id, s.owner_id, s.plan::text, null, s.status, 'inicio_historico'
  from public.subscriptions s
 where not exists (select 1 from public.assinatura_eventos e where e.origem = 'inicio_historico');
-- Sem nenhuma assinatura hoje, um marcador sem assinatura registra a data de início.
insert into public.assinatura_eventos (subscription_id, owner_id, plano, status_de, status_para, origem)
select '00000000-0000-0000-0000-000000000000'::uuid, null, null, null, null, 'inicio_historico'
 where not exists (select 1 from public.assinatura_eventos e where e.origem = 'inicio_historico');

-- 2 ──────────────────────────────────────────────────────────────────────────
create table if not exists public.recebimentos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('assinatura', 'comissao')),
  payment_id text not null unique,
  owner_id uuid,
  plano text,
  lead_id uuid,
  valor numeric(12, 2) not null check (valor >= 0),
  pago_em timestamptz not null,
  criado_em timestamptz not null default now()
);
create index if not exists recebimentos_pago_idx on public.recebimentos (pago_em);
alter table public.recebimentos enable row level security;
revoke all on public.recebimentos from anon, authenticated;
grant select, insert on public.recebimentos to service_role;

-- 3 ──────────────────────────────────────────────────────────────────────────
-- Assinaturas ATIVAS por plano num instante, reconstruídas pelo histórico.
-- NULL quando o instante é anterior ao início do histórico.
create or replace function public.admin_assinaturas_em(t timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when t < (select min(criado_em) from assinatura_eventos where origem = 'inicio_historico') then null
    when not exists (select 1 from assinatura_eventos) then null
    else (
      select coalesce(jsonb_object_agg(plano, n), '{}'::jsonb)
        from (
          select u.plano, count(*) n
            from (
              select distinct on (e.subscription_id) e.subscription_id, e.plano, e.status_para
                from assinatura_eventos e
               where e.criado_em <= t and e.status_para is not null
               order by e.subscription_id, e.criado_em desc, e.id desc
            ) u
           where u.status_para = 'active'
           group by u.plano
        ) a
    )
  end;
$$;
revoke all on function public.admin_assinaturas_em(timestamptz) from public, anon, authenticated;

create or replace function public.admin_financeiro(p_inicio date, p_fim date, p_cidade text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  papel text := coalesce(current_setting('role', true), 'none');
  k text := nullif(public.chave_cidade(p_cidade), '');
  ini timestamptz;
  fim timestamptz;
  inicio_hist timestamptz;
  mes_ini date;
  agora_fim timestamptz;
  a30 jsonb;
begin
  if not (
    public.is_admin()
    or papel = 'service_role'
    or (papel = 'none' and session_user in ('postgres', 'supabase_admin'))
  ) then
    raise exception 'Só a equipe vê o financeiro.' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 1100 then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;

  ini := p_inicio::timestamp at time zone 'America/Sao_Paulo';
  fim := (p_fim + 1)::timestamp at time zone 'America/Sao_Paulo';
  inicio_hist := (select min(criado_em) from assinatura_eventos where origem = 'inicio_historico');
  mes_ini := date_trunc('month', p_inicio)::date;
  agora_fim := least(fim, now());
  a30 := public.admin_assinaturas_em(agora_fim - interval '30 days');

  return jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'cidade', k),
    'historico_desde', inicio_hist,

    -- Assinaturas (sem cidade: NULL com filtro de cidade).
    'assinaturas', case when k is null then jsonb_build_object(
      'agora', (select coalesce(jsonb_object_agg(plano, n), '{}'::jsonb)
                  from (select s.plan::text plano, count(*) n from subscriptions s
                         where s.status = 'active' group by 1) a),
      'inicio', public.admin_assinaturas_em(ini),
      'fim', public.admin_assinaturas_em(agora_fim),
      'novas', (select count(*) from assinatura_eventos e
                 where e.origem = 'gatilho' and e.criado_em >= ini and e.criado_em < fim
                   and e.status_para = 'active' and e.status_de is distinct from 'active'),
      'saidas', (select count(*) from assinatura_eventos e
                  where e.origem = 'gatilho' and e.criado_em >= ini and e.criado_em < fim
                    and e.status_de = 'active' and e.status_para is distinct from 'active'),
      -- Churn mensal: saídas nos 30 dias até o fim ÷ ativas 30 dias antes.
      'ativas_30d_antes', case when a30 is null then null else
                    (select coalesce(sum(value::int), 0) from jsonb_each_text(a30)) end,
      'saidas_30d', case when a30 is null then null else
                    (select count(*) from assinatura_eventos e
                      where e.origem = 'gatilho'
                        and e.criado_em >= agora_fim - interval '30 days' and e.criado_em < agora_fim
                        and e.status_de = 'active' and e.status_para is distinct from 'active') end
    ) end,

    -- Dinheiro que ENTROU (Asaas). Comissão filtra pela cidade do imóvel.
    'recebido', jsonb_build_object(
      'assinatura', case when k is null then
          (select coalesce(sum(r.valor), 0) from recebimentos r
            where r.tipo = 'assinatura' and r.pago_em >= ini and r.pago_em < fim) end,
      'comissao', (select coalesce(sum(r.valor), 0) from recebimentos r
            left join leads l on l.id = r.lead_id
            left join properties p on p.id = l.property_id
           where r.tipo = 'comissao' and r.pago_em >= ini and r.pago_em < fim
             and (k is null or chave_cidade(p.city) = k))
    ),

    -- Comissões dos contratos do período (sem dado pessoal).
    'comissoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'contrato', c.id,
               'data', (c.created_at at time zone 'America/Sao_Paulo')::date,
               'imovel', p.title,
               'cidade', p.city,
               'plano', c.owner_plan,
               'percentual', c.comissao_percent,
               'aluguel', c.aluguel_mensal,
               'comissao', c.comissao_valor,
               'status', coalesce(cf.status, case when cf.lead_id is null then 'sem_cobranca' else 'pendente' end),
               'pago_em', cf.pago_em
             ) order by c.created_at desc), '[]'::jsonb)
        from (select * from contratos c0
               where c0.created_at >= ini and c0.created_at < fim
               order by c0.created_at desc limit 500) c
        join properties p on p.id = c.property_id
        left join cobrancas_fechamento cf on cf.lead_id = c.lead_id and cf.tipo = 'comissao'
       where (k is null or chave_cidade(p.city) = k)
    ),

    -- Marketing: meses inteiros tocados pelo período (lançamento é mensal).
    'marketing', case when k is null then jsonb_build_object(
      'gasto', (select coalesce(sum(g.valor), 0) from gastos_marketing g where g.mes >= mes_ini and g.mes <= p_fim),
      'meses', (select coalesce(jsonb_agg(distinct to_char(g.mes, 'YYYY-MM')), '[]'::jsonb)
                  from gastos_marketing g where g.mes >= mes_ini and g.mes <= p_fim),
      'novos_proprietarios', (select count(*) from profiles pr
            where pr.role = 'owner' and pr.anonymized_at is null
              and pr.created_at >= mes_ini::timestamp at time zone 'America/Sao_Paulo' and pr.created_at < fim)
    ) end,

    -- Série mensal: 12 meses terminando no mês do fim do período.
    'mensal', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'mes', to_char(m, 'YYYY-MM'),
               'receita_assinatura', case when k is null then (select coalesce(sum(r.valor), 0) from recebimentos r
                   where r.tipo = 'assinatura' and r.pago_em >= m::timestamp at time zone 'America/Sao_Paulo'
                     and r.pago_em < (m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo') end,
               'receita_comissao', (select coalesce(sum(r.valor), 0) from recebimentos r
                   left join leads l on l.id = r.lead_id left join properties p on p.id = l.property_id
                   where r.tipo = 'comissao' and r.pago_em >= m::timestamp at time zone 'America/Sao_Paulo'
                     and r.pago_em < (m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo'
                     and (k is null or chave_cidade(p.city) = k)),
               'gasto_marketing', case when k is null then (select coalesce(sum(g.valor), 0) from gastos_marketing g where g.mes = m::date) end,
               'novos_proprietarios', case when k is null then (select count(*) from profiles pr
                   where pr.role = 'owner' and pr.anonymized_at is null
                     and pr.created_at >= m::timestamp at time zone 'America/Sao_Paulo'
                     and pr.created_at < (m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo') end,
               'assinaturas_fim_mes', case when k is null then public.admin_assinaturas_em(
                   least((m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo', now())) end
             ) order by m), '[]'::jsonb)
        from generate_series(date_trunc('month', p_fim) - interval '11 months', date_trunc('month', p_fim), interval '1 month') m
    )
  );
end;
$$;
revoke all on function public.admin_financeiro(date, date, text) from public, anon;
grant execute on function public.admin_financeiro(date, date, text) to authenticated, service_role;

-- Conferência (rodar depois):
--   select jsonb_pretty(public.admin_financeiro(current_date - 29, current_date));
--   select count(*) from public.assinatura_eventos where origem = 'inicio_historico';  -- ≥ 1
--   select has_table_privilege('anon', 'public.recebimentos', 'select');               -- false
