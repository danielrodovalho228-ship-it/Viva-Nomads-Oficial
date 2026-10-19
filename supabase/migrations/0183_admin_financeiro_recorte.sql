-- Viva Nomads — 0183: /admin/financeiro com UMA base (complemento do Prompt 29, item 3).
-- O mesmo seletor de /admin/contratos (Real · Teste · Todos, padrão Real) comanda TODOS os cartões da página.
-- admin_financeiro (0071) continua igual; a página passa a ler admin_financeiro_recorte, que é a mesma conta com
-- o recorte aplicado em cada parte (assinaturas, recebimentos, taxas, marketing e a série mensal).
-- Teste = conta is_teste (0135) ou anúncio [TESTE…]/[QA…] (admin_eh_teste / admin_imovel_real, 0181).

-- p_tipo: 'real' (só o que não é teste), 'teste' (só teste) ou 'todos'.
create or replace function public.admin_no_recorte(eh_teste boolean, p_tipo text)
returns boolean
language sql
immutable
as $$
  select case coalesce(p_tipo, 'real') when 'todos' then true when 'teste' then coalesce(eh_teste, false) else not coalesce(eh_teste, false) end;
$$;
revoke all on function public.admin_no_recorte(boolean, text) from public, anon, authenticated;

-- Candidatura de teste: inquilino de teste ou imóvel que não é real (mesma regra de leadsDeTeste no código).
create or replace function public.admin_lead_teste(lead uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select public.admin_eh_teste(l.tenant_id) or not public.admin_imovel_real(p.owner_id, p.title)
                     from leads l join properties p on p.id = l.property_id where l.id = lead), false);
$$;
revoke all on function public.admin_lead_teste(uuid) from public, anon, authenticated;

-- Assinaturas ativas por plano num instante (como admin_assinaturas_em, 0071), só as do recorte.
create or replace function public.admin_assinaturas_em_recorte(t timestamptz, p_tipo text)
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
              select distinct on (e.subscription_id) e.subscription_id, e.owner_id, e.plano, e.status_para
                from assinatura_eventos e
               where e.criado_em <= t and e.status_para is not null
               order by e.subscription_id, e.criado_em desc, e.id desc
            ) u
           where u.status_para = 'active' and public.admin_no_recorte(public.admin_eh_teste(u.owner_id), p_tipo)
           group by u.plano
        ) a
    )
  end;
$$;
revoke all on function public.admin_assinaturas_em_recorte(timestamptz, text) from public, anon, authenticated;

create or replace function public.admin_financeiro_recorte(p_inicio date, p_fim date, p_cidade text default null, p_tipo text default 'real')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  papel text := coalesce(current_setting('role', true), 'none');
  k text := nullif(public.chave_cidade(p_cidade), '');
  tp text := case when p_tipo in ('teste', 'todos') then p_tipo else 'real' end;
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
  a30 := public.admin_assinaturas_em_recorte(agora_fim - interval '30 days', tp);

  return jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'cidade', k, 'tipo', tp),
    'historico_desde', inicio_hist,

    'assinaturas', case when k is null then jsonb_build_object(
      'agora', (select coalesce(jsonb_object_agg(plano, n), '{}'::jsonb)
                  from (select s.plan::text plano, count(*) n from subscriptions s
                         where s.status = 'active' and public.admin_no_recorte(public.admin_eh_teste(s.owner_id), tp)
                         group by 1) a),
      'inicio', public.admin_assinaturas_em_recorte(ini, tp),
      'fim', public.admin_assinaturas_em_recorte(agora_fim, tp),
      'novas', (select count(*) from assinatura_eventos e
                 where e.origem = 'gatilho' and e.criado_em >= ini and e.criado_em < fim
                   and e.status_para = 'active' and e.status_de is distinct from 'active'
                   and public.admin_no_recorte(public.admin_eh_teste(e.owner_id), tp)),
      'saidas', (select count(*) from assinatura_eventos e
                  where e.origem = 'gatilho' and e.criado_em >= ini and e.criado_em < fim
                    and e.status_de = 'active' and e.status_para is distinct from 'active'
                    and public.admin_no_recorte(public.admin_eh_teste(e.owner_id), tp)),
      'ativas_30d_antes', case when a30 is null then null else
                    (select coalesce(sum(value::int), 0) from jsonb_each_text(a30)) end,
      'saidas_30d', case when a30 is null then null else
                    (select count(*) from assinatura_eventos e
                      where e.origem = 'gatilho'
                        and e.criado_em >= agora_fim - interval '30 days' and e.criado_em < agora_fim
                        and e.status_de = 'active' and e.status_para is distinct from 'active'
                        and public.admin_no_recorte(public.admin_eh_teste(e.owner_id), tp)) end
    ) end,

    'recebido', jsonb_build_object(
      'assinatura', case when k is null then
          (select coalesce(sum(r.valor), 0) from recebimentos r
            where r.tipo = 'assinatura' and r.pago_em >= ini and r.pago_em < fim
              and public.admin_no_recorte(public.admin_eh_teste(r.owner_id), tp)) end,
      'comissao', (select coalesce(sum(r.valor), 0) from recebimentos r
            left join leads l on l.id = r.lead_id
            left join properties p on p.id = l.property_id
           where r.tipo = 'comissao' and r.pago_em >= ini and r.pago_em < fim
             and (k is null or chave_cidade(p.city) = k)
             and public.admin_no_recorte(public.admin_lead_teste(r.lead_id), tp))
    ),

    -- Gasto de marketing é dinheiro de verdade, sem conta: entra em Real e em Todos, nunca em Teste.
    'marketing', case when k is null then jsonb_build_object(
      'gasto', case when tp = 'teste' then 0 else
          (select coalesce(sum(g.valor), 0) from gastos_marketing g where g.mes >= mes_ini and g.mes <= p_fim) end,
      'meses', case when tp = 'teste' then '[]'::jsonb else
          (select coalesce(jsonb_agg(distinct to_char(g.mes, 'YYYY-MM')), '[]'::jsonb)
             from gastos_marketing g where g.mes >= mes_ini and g.mes <= p_fim) end,
      'novos_proprietarios', (select count(*) from profiles pr
            where pr.role = 'owner' and pr.anonymized_at is null
              and pr.created_at >= mes_ini::timestamp at time zone 'America/Sao_Paulo' and pr.created_at < fim
              and public.admin_no_recorte(coalesce(pr.is_teste, false), tp))
    ) end,

    'mensal', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'mes', to_char(m, 'YYYY-MM'),
               'receita_assinatura', case when k is null then (select coalesce(sum(r.valor), 0) from recebimentos r
                   where r.tipo = 'assinatura' and r.pago_em >= m::timestamp at time zone 'America/Sao_Paulo'
                     and r.pago_em < (m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo'
                     and public.admin_no_recorte(public.admin_eh_teste(r.owner_id), tp)) end,
               'receita_comissao', (select coalesce(sum(r.valor), 0) from recebimentos r
                   left join leads l on l.id = r.lead_id left join properties p on p.id = l.property_id
                   where r.tipo = 'comissao' and r.pago_em >= m::timestamp at time zone 'America/Sao_Paulo'
                     and r.pago_em < (m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo'
                     and (k is null or chave_cidade(p.city) = k)
                     and public.admin_no_recorte(public.admin_lead_teste(r.lead_id), tp)),
               'gasto_marketing', case when k is null then (case when tp = 'teste' then 0 else
                   (select coalesce(sum(g.valor), 0) from gastos_marketing g where g.mes = m::date) end) end,
               'novos_proprietarios', case when k is null then (select count(*) from profiles pr
                   where pr.role = 'owner' and pr.anonymized_at is null
                     and pr.created_at >= m::timestamp at time zone 'America/Sao_Paulo'
                     and pr.created_at < (m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo'
                     and public.admin_no_recorte(coalesce(pr.is_teste, false), tp)) end,
               'assinaturas_fim_mes', case when k is null then public.admin_assinaturas_em_recorte(
                   least((m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo', now()), tp) end
             ) order by m), '[]'::jsonb)
        from generate_series(date_trunc('month', p_fim) - interval '11 months', date_trunc('month', p_fim), interval '1 month') m
    )
  );
end;
$$;
revoke all on function public.admin_financeiro_recorte(date, date, text, text) from public, anon;
grant execute on function public.admin_financeiro_recorte(date, date, text, text) to authenticated, service_role;

-- Conferência (rodar depois):
--   select (public.admin_financeiro_recorte(current_date - 29, current_date, null, 'todos') - 'periodo')
--        = (public.admin_financeiro(current_date - 29, current_date) - 'periodo' - 'comissoes');   -- true
