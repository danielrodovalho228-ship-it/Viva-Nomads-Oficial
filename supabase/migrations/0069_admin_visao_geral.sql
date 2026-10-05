-- ─────────────────────────────────────────────────────────────────────────────
-- 0069 — visão geral do /admin (PR B). Idempotente.
--
-- Uma função AGREGADA, só para a equipe: devolve números (nunca linhas, nunca
-- dado pessoal) do período escolhido E do período anterior de mesmo tamanho,
-- a série diária (sparklines), fotos do "agora" e a fila "Precisa de você".
--
--   admin_visao_geral(p_inicio date, p_fim date, p_cidade text default null)
--
-- Datas inclusivas, no horário de Brasília. p_cidade filtra pela chave da
-- cidade (chave_cidade, 0059); métrica sem cidade (cadastros) volta NULL com
-- filtro de cidade — a tela mostra "—", nunca um número enganoso.
-- Divisões ficam para a tela (0 no denominador → "—", nunca 0% nem NaN).
-- ─────────────────────────────────────────────────────────────────────────────

-- Métricas de UM período [ini, fim). Interna: só a função pública chama.
create or replace function public.admin_metricas_periodo(ini timestamptz, fim timestamptz, k text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  leads_p as (
    select l.*
      from leads l
      join properties p on p.id = l.property_id
     where l.created_at >= ini and l.created_at < fim
       and (k is null or chave_cidade(p.city) = k)
  ),
  contratos_p as (
    select c.*
      from contratos c
      join properties p on p.id = c.property_id
     where c.created_at >= ini and c.created_at < fim
       and (k is null or chave_cidade(p.city) = k)
  ),
  pedidos_p as (
    select pm.*
      from pedidos_moradia pm
     where pm.criado_em >= ini and pm.criado_em < fim
       and (k is null or chave_cidade(pm.cidade) = k)
  ),
  eventos_p as (
    select e.tipo
      from eventos e
     where e.criado_em >= ini and e.criado_em < fim
       and (k is null or e.cidade_chave = k)
  ),
  chamados_p as (
    select so.*
      from service_orders so
      join properties p on p.id = so.property_id
     where so.opened_at >= ini and so.opened_at < fim
       and (k is null or chave_cidade(p.city) = k)
  ),
  comissao_paga as (
    select cf.lead_id, c.comissao_valor
      from cobrancas_fechamento cf
      join leads l on l.id = cf.lead_id
      join properties p on p.id = l.property_id
      left join contratos c on c.lead_id = cf.lead_id
     where cf.tipo = 'comissao' and cf.status = 'pago'
       and cf.pago_em >= ini and cf.pago_em < fim
       and (k is null or chave_cidade(p.city) = k)
  )
  select jsonb_build_object(
    -- Crescimento (sem cidade no cadastro: NULL quando há filtro de cidade)
    'novos_proprietarios', case when k is null then
        (select count(*) from profiles where role = 'owner' and anonymized_at is null
            and created_at >= ini and created_at < fim) end,
    'novos_inquilinos', case when k is null then
        (select count(*) from profiles where role = 'tenant' and anonymized_at is null
            and created_at >= ini and created_at < fim) end,
    'cadastros_iniciados', (select count(*) from eventos_p where tipo = 'iniciar_cadastro'),
    'cadastros_concluidos', (select count(*) from eventos_p where tipo = 'concluir_cadastro'),
    -- Oferta
    'anuncios_novos', (select count(*) from properties p
        where p.created_at >= ini and p.created_at < fim and p.status::text = 'active'
          and (k is null or chave_cidade(p.city) = k)),
    'anuncios_publicados_evento', (select count(*) from eventos_p where tipo = 'publicar_anuncio'),
    'anuncios_iniciados', (select count(*) from eventos_p where tipo = 'iniciar_anuncio'),
    -- Demanda
    'buscas', (select count(*) from eventos_p where tipo = 'busca'),
    'visualizacoes', (select count(*) from eventos_p where tipo = 'ver_anuncio'),
    'favoritos', (select count(*) from eventos_p where tipo = 'favoritar'),
    'candidaturas_iniciadas', (select count(*) from eventos_p where tipo = 'iniciar_candidatura'),
    'candidaturas', (select count(*) from leads_p),
    'pedidos', (select count(*) from pedidos_p),
    -- Liquidez
    'candidaturas_decididas', (select count(*) from leads_p where accepted_at is not null or rejected_at is not null),
    'candidaturas_aceitas', (select count(*) from leads_p where accepted_at is not null),
    'horas_mediana_decisao', (select round((percentile_cont(0.5) within group (order by
          extract(epoch from coalesce(accepted_at, rejected_at) - created_at) / 3600.0))::numeric, 1)
        from leads_p where coalesce(accepted_at, rejected_at) is not null),
    'pedidos_com_resposta', (select count(*) from pedidos_p pm
        where exists (select 1 from respostas_pedido r where r.pedido_id = pm.id)),
    -- Receita (aluguel NÃO passa pela plataforma: só informativo)
    'contratos', (select count(*) from contratos_p),
    'comissao_gerada', (select coalesce(sum(comissao_valor), 0) from contratos_p),
    'comissao_recebida', (select coalesce(sum(comissao_valor), 0) from comissao_paga),
    'comissoes_pagas', (select count(*) from comissao_paga),
    'aluguel_contratado', (select coalesce(sum(aluguel_mensal), 0) from contratos_p),
    -- Operação
    'chamados', (select count(*) from chamados_p),
    'chamados_resolvidos', (select count(*) from chamados_p where resolved_at is not null),
    'horas_mediana_1a_resposta', (select round((percentile_cont(0.5) within group (order by
          extract(epoch from first_response_at - opened_at) / 3600.0))::numeric, 1)
        from chamados_p where first_response_at is not null)
  );
$$;
revoke all on function public.admin_metricas_periodo(timestamptz, timestamptz, text) from public, anon, authenticated;

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
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'dia', d::date,
               'cadastros', case when k is null then (select count(*) from profiles pr
                   where pr.anonymized_at is null and pr.role in ('owner', 'tenant')
                     and pr.created_at >= d and pr.created_at < d + interval '1 day') end,
               'pedidos', (select count(*) from pedidos_moradia pm
                   where pm.criado_em >= d and pm.criado_em < d + interval '1 day'
                     and (k is null or chave_cidade(pm.cidade) = k)),
               'candidaturas', (select count(*) from leads l join properties p on p.id = l.property_id
                   where l.created_at >= d and l.created_at < d + interval '1 day'
                     and (k is null or chave_cidade(p.city) = k)),
               'contratos', (select count(*) from contratos c join properties p on p.id = c.property_id
                   where c.created_at >= d and c.created_at < d + interval '1 day'
                     and (k is null or chave_cidade(p.city) = k)),
               'buscas', (select count(*) from eventos e
                   where e.tipo = 'busca' and e.criado_em >= d and e.criado_em < d + interval '1 day'
                     and (k is null or e.cidade_chave = k)),
               'visualizacoes', (select count(*) from eventos e
                   where e.tipo = 'ver_anuncio' and e.criado_em >= d and e.criado_em < d + interval '1 day'
                     and (k is null or e.cidade_chave = k))
             ) order by d), '[]'::jsonb)
        from generate_series(ini, fim - interval '1 day', interval '1 day') d
    ),

    -- Fotografia de AGORA (não depende do período).
    'agora', jsonb_build_object(
      'imoveis_ativos', (select count(*) from properties p where p.status::text = 'active'
          and (k is null or chave_cidade(p.city) = k)),
      'rascunhos', (select count(*) from properties p where p.status::text = 'draft'
          and (k is null or chave_cidade(p.city) = k)),
      'proprietarios_com_anuncio', (select count(distinct p.owner_id) from properties p
          where p.status::text = 'active' and (k is null or chave_cidade(p.city) = k)),
      'pedidos_ativos', (select count(*) from pedidos_moradia pm where pm.status = 'ativo'
          and (k is null or chave_cidade(pm.cidade) = k)),
      'usuarios', case when k is null then (select count(*) from profiles
          where anonymized_at is null and role in ('owner', 'tenant')) end,
      'fundadores', case when k is null then (select count(*) from profiles where fundador) end,
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
            and l.created_at < now() - interval '48 hours'),
      'chamados_urgentes_sem_resposta', (select jsonb_build_object('n', count(*),
            'horas_mais_antigo', round((extract(epoch from now() - min(so.opened_at)) / 3600)::numeric))
          from service_orders so where so.priority::text = 'urgente'
            and so.status::text <> 'resolvido' and so.first_response_at is null
            and so.opened_at < now() - interval '4 hours'),
      'comissoes_vencidas', (select jsonb_build_object('n', count(*),
            'horas_mais_antigo', round((extract(epoch from now() - min(cf.criado_em)) / 3600)::numeric))
          from cobrancas_fechamento cf where cf.tipo = 'comissao' and cf.status = 'vencido'),
      'pedidos_sem_resposta_expirando', (select jsonb_build_object('n', count(*),
            'horas_mais_antigo', null)
          from pedidos_moradia pm where pm.status = 'ativo'
            and pm.expira_em < now() + interval '3 days'
            and not exists (select 1 from respostas_pedido r where r.pedido_id = pm.id))
    )
  );
end;
$$;
revoke all on function public.admin_visao_geral(date, date, text) from public, anon;
grant execute on function public.admin_visao_geral(date, date, text) to authenticated, service_role;

-- Conferência (rodar depois, no SQL Editor):
--   select jsonb_pretty(public.admin_visao_geral(current_date - 29, current_date));
--   select has_function_privilege('anon', 'public.admin_visao_geral(date,date,text)', 'execute'); -- false
