-- 0342 (Frente 3, PR #3736: o t231 do lab-critico): a série diária de admin_visao_geral agrega cada tabela UMA vez por dia
-- de Brasília, em vez de 6 subconsultas correlacionadas POR DIA do período (O(dias × linhas)). Num período longo
-- (o t231 sorteia de 40 a 340 dias) a função passava do statement_timeout (8 s) no runner do CI:
-- "[admin] visão geral: canceling statement due to statement timeout" e todos os indicadores da tela viravam "—".
-- Mesmo resultado, dia a dia (provado no laboratório contra a função da 0266); o resto da função é o da 0266.

create or replace function public.admin_visao_geral(p_inicio date, p_fim date, p_cidade text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  papel text := coalesce(current_setting('role', true), 'none');
  k text := nullif(public.chave_cidade(p_cidade), '');
  dias int;
  ini timestamptz;
  fim timestamptz;
  ini_ant timestamptz;
begin
  -- Mesmo critério da 0068 (current_user não serve dentro de SECURITY DEFINER).
  if not (
    public.is_admin()
    or papel = 'service_role'
    or (papel = 'none' and session_user in ('postgres', 'supabase_admin'))
  ) then
    raise exception 'Só a equipe vê os números da plataforma.' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  if p_fim - p_inicio > 1100 then
    raise exception 'Período longo demais (máx. 3 anos).' using errcode = '22023';
  end if;

  dias := p_fim - p_inicio + 1;
  ini := p_inicio::timestamp at time zone 'America/Sao_Paulo';
  fim := (p_fim + 1)::timestamp at time zone 'America/Sao_Paulo';
  ini_ant := (p_inicio - dias)::timestamp at time zone 'America/Sao_Paulo';

  return jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias', dias,
                                  'inicio_anterior', p_inicio - dias, 'fim_anterior', p_inicio - 1,
                                  'cidade', k),
    'atual', public.admin_metricas_periodo(ini, fim, k),
    'anterior', public.admin_metricas_periodo(ini_ant, ini, k),

    -- Série diária para as sparklines (um ponto por dia do período).
    -- 0342: cada tabela é lida UMA vez e agrupada pelo dia de Brasília (antes: 6 subconsultas POR DIA, O(dias × linhas) —
    -- num período de 340 dias a função passava do statement_timeout de 8 s no laboratório do CI e a tela mostrava "—").
    'serie', (
      with dias as (
        select d, (d at time zone 'America/Sao_Paulo')::date as dia
          from generate_series(ini, fim - interval '1 day', interval '1 day') d
      ),
      cad as (
        select (pr.created_at at time zone 'America/Sao_Paulo')::date as dia, count(*) as n
          from profiles pr
         where k is null and pr.anonymized_at is null and pr.role in ('owner', 'tenant') and not coalesce(pr.is_teste, false)
           and pr.created_at >= ini and pr.created_at < fim
         group by 1
      ),
      ped as (
        select (pm.criado_em at time zone 'America/Sao_Paulo')::date as dia, count(*) as n
          from pedidos_moradia pm
         where pm.criado_em >= ini and pm.criado_em < fim
           and (k is null or chave_cidade(pm.cidade) = k) and not public.admin_eh_teste(pm.inquilino_id)
         group by 1
      ),
      cand as (
        select (l.created_at at time zone 'America/Sao_Paulo')::date as dia, count(*) as n
          from leads l join properties p on p.id = l.property_id
         where l.created_at >= ini and l.created_at < fim
           and (k is null or chave_cidade(p.city) = k) and public.admin_imovel_real(p.owner_id, p.title) and not public.admin_eh_teste(l.tenant_id)
         group by 1
      ),
      contr as (
        select (c.created_at at time zone 'America/Sao_Paulo')::date as dia, count(*) as n
          from contratos c join properties p on p.id = c.property_id
         where c.created_at >= ini and c.created_at < fim
           and (k is null or chave_cidade(p.city) = k) and public.admin_imovel_real(p.owner_id, p.title) and not public.admin_eh_teste(c.tenant_id)
         group by 1
      ),
      ev as (
        select (e.criado_em at time zone 'America/Sao_Paulo')::date as dia,
               count(*) filter (where e.tipo = 'busca') as buscas,
               count(*) filter (where e.tipo = 'ver_anuncio') as visualizacoes
          from eventos e
         where e.tipo in ('busca', 'ver_anuncio') and e.criado_em >= ini and e.criado_em < fim
           and (k is null or e.cidade_chave = k)
           and e.trafego = 'real' and (e.usuario_id is null or not public.admin_eh_teste(e.usuario_id))
         group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object(
               'dia', dd.d::date,
               'cadastros', case when k is null then coalesce(cad.n, 0) end,
               'pedidos', coalesce(ped.n, 0),
               'candidaturas', coalesce(cand.n, 0),
               'contratos', coalesce(contr.n, 0),
               'buscas', coalesce(ev.buscas, 0),
               'visualizacoes', coalesce(ev.visualizacoes, 0)
             ) order by dd.d), '[]'::jsonb)
        from dias dd
        left join cad on cad.dia = dd.dia
        left join ped on ped.dia = dd.dia
        left join cand on cand.dia = dd.dia
        left join contr on contr.dia = dd.dia
        left join ev on ev.dia = dd.dia
    ),

    -- Fotografia de AGORA (não depende do período).
    'agora', jsonb_build_object(
      'imoveis_ativos', (select count(*) from properties p where p.status::text = 'active'
          and (k is null or chave_cidade(p.city) = k) and public.admin_imovel_real(p.owner_id, p.title)),
      'rascunhos', (select count(*) from properties p where p.status::text = 'draft'
          and (k is null or chave_cidade(p.city) = k) and public.admin_imovel_real(p.owner_id, p.title)),
      'proprietarios_com_anuncio', (select count(distinct p.owner_id) from properties p
          where p.status::text = 'active' and (k is null or chave_cidade(p.city) = k) and public.admin_imovel_real(p.owner_id, p.title)),
      'pedidos_ativos', (select count(*) from pedidos_moradia pm where pm.status = 'ativo'
          and (k is null or chave_cidade(pm.cidade) = k) and not public.admin_eh_teste(pm.inquilino_id)),
      'usuarios', case when k is null then (select count(*) from profiles
          where anonymized_at is null and role in ('owner', 'tenant') and not coalesce(is_teste, false)) end,
      'fundadores', case when k is null then (select count(*) from profiles where fundador and not coalesce(is_teste, false)) end,
      'assinaturas', case when k is null then (
          select coalesce(jsonb_object_agg(plano, n), '{}'::jsonb)
            from (select s.plan::text plano, count(*) n from subscriptions s
                   where s.status = 'active' group by 1) a) end
    ),

    -- "Precisa de você agora": filas da equipe (contagem + item mais antigo, em horas).
    'precisa', jsonb_build_object(
      'documentos_pendentes', (select jsonb_build_object('n', count(*),
            'horas_mais_antigo', round((extract(epoch from now() - min(coalesce(qc.document_uploaded_at, qc.created_at))) / 3600)::numeric))
          from qualification_checklists qc where qc.document_status = 'pending'),
      'candidaturas_sem_resposta_48h', (select jsonb_build_object('n', count(*),
            'horas_mais_antigo', round((extract(epoch from now() - min(l.created_at)) / 3600)::numeric))
          from leads l where l.accepted_at is null and l.rejected_at is null
            and l.status not in ('accepted', 'rejected', 'cancelled', 'canceled', 'expired')
            and l.created_at < now() - interval '48 hours'
            and not public.admin_eh_teste(l.tenant_id)
            and exists (select 1 from properties p where p.id = l.property_id and public.admin_imovel_real(p.owner_id, p.title))),
      'chamados_urgentes_sem_resposta', (select jsonb_build_object('n', count(*),
            'horas_mais_antigo', round((extract(epoch from now() - min(so.opened_at)) / 3600)::numeric))
          from service_orders so where so.priority::text = 'urgente'
            and so.status::text <> 'resolvido' and so.first_response_at is null
            and so.opened_at < now() - interval '4 hours' and coalesce(so.simulacao, false) = false),
      'comissoes_vencidas', (select jsonb_build_object('n', count(*),
            'horas_mais_antigo', round((extract(epoch from now() - min(cf.criado_em)) / 3600)::numeric))
          from cobrancas_fechamento cf where cf.tipo = 'comissao' and cf.status = 'vencido'),
      'pedidos_sem_resposta_expirando', (select jsonb_build_object('n', count(*),
            'horas_mais_antigo', null)
          from pedidos_moradia pm where pm.status = 'ativo'
            and pm.expira_em < now() + interval '3 days' and not public.admin_eh_teste(pm.inquilino_id)
            and not exists (select 1 from respostas_pedido r where r.pedido_id = pm.id))
    )
  );
end;
$$;

revoke all on function public.admin_visao_geral(date, date, text) from public, anon, authenticated;
grant execute on function public.admin_visao_geral(date, date, text) to service_role;
