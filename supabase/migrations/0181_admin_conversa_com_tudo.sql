-- Viva Nomads — 0181: /admin "conversa com tudo" (Prompt 29). Contas de teste (profiles.is_teste) e anúncios
-- [TESTE…] ficam fora de todos os números da home do admin; as métricas de atendimento passam a devolver os
-- encerrados sem resolução e os chamados abertos AGORA (a mesma fonte da home e da aba Métricas). Só redefine
-- funções (create or replace): nada de dado é alterado. Idempotente. Rollback: supabase/producao/rollback/0181_rollback.sql.
-- Conta de teste e imóvel real (Prompt 29: contas is_teste ficam fora de TODO número do admin).
create or replace function public.admin_eh_teste(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_teste from profiles where id = uid), false);
$$;
revoke all on function public.admin_eh_teste(uuid) from public, anon, authenticated;

-- Real = dono que não é conta de teste e título sem a marca [TESTE…]/[QA…] (mesma regra de anuncio-teste.ts).
create or replace function public.admin_imovel_real(dono uuid, titulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.admin_eh_teste(dono)
     and coalesce(titulo, '') !~* '^\s*\[\s*(teste|test|qa)\M[^\]]*\]';
$$;
revoke all on function public.admin_imovel_real(uuid, text) from public, anon, authenticated;

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
       and public.admin_imovel_real(p.owner_id, p.title) and not public.admin_eh_teste(l.tenant_id)
  ),
  contratos_p as (
    select c.*
      from contratos c
      join properties p on p.id = c.property_id
     where c.created_at >= ini and c.created_at < fim
       and (k is null or chave_cidade(p.city) = k)
       and public.admin_imovel_real(p.owner_id, p.title) and not public.admin_eh_teste(c.tenant_id)
  ),
  pedidos_p as (
    select pm.*
      from pedidos_moradia pm
     where pm.criado_em >= ini and pm.criado_em < fim
       and (k is null or chave_cidade(pm.cidade) = k)
       and not public.admin_eh_teste(pm.inquilino_id)
  ),
  eventos_p as (
    select e.tipo
      from eventos e
     where e.criado_em >= ini and e.criado_em < fim
       and (k is null or e.cidade_chave = k)
       and (e.usuario_id is null or not public.admin_eh_teste(e.usuario_id))
  ),
  chamados_p as (
    select so.*
      from service_orders so
      join properties p on p.id = so.property_id
     where so.opened_at >= ini and so.opened_at < fim
       and (k is null or chave_cidade(p.city) = k)
       and public.admin_imovel_real(p.owner_id, p.title) and coalesce(so.simulacao, false) = false
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
       and public.admin_imovel_real(p.owner_id, p.title) and not public.admin_eh_teste(l.tenant_id)
  )
  select jsonb_build_object(
    -- Crescimento (sem cidade no cadastro: NULL quando há filtro de cidade)
    'novos_proprietarios', case when k is null then
        (select count(*) from profiles where role = 'owner' and anonymized_at is null and not coalesce(is_teste, false)
            and created_at >= ini and created_at < fim) end,
    'novos_inquilinos', case when k is null then
        (select count(*) from profiles where role = 'tenant' and anonymized_at is null and not coalesce(is_teste, false)
            and created_at >= ini and created_at < fim) end,
    'cadastros_iniciados', (select count(*) from eventos_p where tipo = 'iniciar_cadastro'),
    'cadastros_concluidos', (select count(*) from eventos_p where tipo = 'concluir_cadastro'),
    -- Oferta
    'anuncios_novos', (select count(*) from properties p
        where p.created_at >= ini and p.created_at < fim and p.status::text = 'active'
          and (k is null or chave_cidade(p.city) = k) and public.admin_imovel_real(p.owner_id, p.title)),
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
                   where pr.anonymized_at is null and pr.role in ('owner', 'tenant') and not coalesce(pr.is_teste, false)
                     and pr.created_at >= d and pr.created_at < d + interval '1 day') end,
               'pedidos', (select count(*) from pedidos_moradia pm
                   where pm.criado_em >= d and pm.criado_em < d + interval '1 day'
                     and (k is null or chave_cidade(pm.cidade) = k) and not public.admin_eh_teste(pm.inquilino_id)),
               'candidaturas', (select count(*) from leads l join properties p on p.id = l.property_id
                   where l.created_at >= d and l.created_at < d + interval '1 day'
                     and (k is null or chave_cidade(p.city) = k) and public.admin_imovel_real(p.owner_id, p.title) and not public.admin_eh_teste(l.tenant_id)),
               'contratos', (select count(*) from contratos c join properties p on p.id = c.property_id
                   where c.created_at >= d and c.created_at < d + interval '1 day'
                     and (k is null or chave_cidade(p.city) = k) and public.admin_imovel_real(p.owner_id, p.title) and not public.admin_eh_teste(c.tenant_id)),
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
revoke all on function public.admin_visao_geral(date, date, text) from public, anon;
grant execute on function public.admin_visao_geral(date, date, text) to authenticated, service_role;


create or replace function public.admin_atendimento_metricas(p_dias int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  papel text := coalesce(current_setting('role', true), 'none');
  ini timestamptz := now() - make_interval(days => greatest(1, least(p_dias, 400)));
  contratos_n int;
begin
  if not (
    public.is_admin()
    or papel = 'service_role'
    or (papel = 'none' and session_user in ('postgres', 'supabase_admin'))
  ) then
    raise exception 'Só a equipe vê as métricas de atendimento.' using errcode = '42501';
  end if;
  select count(*) into contratos_n from contratos where created_at >= ini;

  return (
    with c as (select * from chamados where simulacao = false and criado_em >= ini),
    resp as (
      select extract(epoch from primeira_resposta_em - criado_em) / 60.0 as min
        from c where primeira_resposta_em is not null
    ),
    resol as (
      select extract(epoch from resolvido_em - criado_em) / 3600.0 as h
        from c where resolvido_em is not null
    )
    select jsonb_build_object(
      'dias', p_dias,
      'total', (select count(*) from c),
      'por_prioridade', (select coalesce(jsonb_object_agg(prioridade, n), '{}'::jsonb)
                           from (select prioridade, count(*) n from c group by 1) x),
      'por_tipo', (select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb)
                     from (select tipo, count(*) n from c group by 1) x),
      'abertos', (select count(*) from c where status not in ('resolvido', 'encerrado')),
      'primeira_resposta_media_min', (select round(avg(min)::numeric, 1) from resp),
      'primeira_resposta_p90_min', (select round((percentile_cont(0.9) within group (order by min))::numeric, 1) from resp),
      'resolucao_media_h', (select round(avg(h)::numeric, 1) from resol),
      'resolvidos', (select count(*) from c where resolvido_em is not null),
      -- Prompt 29, item 7: resolvidos da home = (resolvidos + encerrados) ÷ chamados do período.
      'encerrados_sem_resolucao', (select count(*) from c where resolvido_em is null and status = 'encerrado'),
      'abertos_agora', (select count(*) from chamados where simulacao = false and status not in ('resolvido', 'encerrado')),
      'resolvidos_ia', (select count(*) from c where resolvido_em is not null and responsavel_tipo = 'ia'),
      'pediu_humano', (select count(distinct e.chamado_id) from chamado_eventos e join c on c.id = e.chamado_id
                        where e.acao = 'pediu_humano'),
      'reabertos_7d', (select count(distinct e.chamado_id) from chamado_eventos e join c on c.id = e.chamado_id
                        where e.acao = 'reaberto' and c.resolvido_em is not null
                          and e.criado_em <= c.resolvido_em + interval '7 days'),
      'satisfacao_media', (select round(avg(nota_satisfacao)::numeric, 2) from c where nota_satisfacao is not null),
      'satisfacao_notas', (select count(*) from c where nota_satisfacao is not null),
      'satisfacao_4_5', (select count(*) from c where nota_satisfacao >= 4),
      'estourados', (select coalesce(jsonb_object_agg(prioridade, n), '{}'::jsonb)
                       from (select prioridade, count(*) n from c where sla_estado = 'estourado' group by 1) x),
      'contratos_periodo', contratos_n,
      'manutencao_resposta_media_h', (select round(avg(extract(epoch from so.first_response_at - so.opened_at) / 3600.0)::numeric, 1)
                                        from service_orders so
                                       where so.simulacao = false and so.opened_at >= ini and so.first_response_at is not null),
      'manutencao_sem_resposta', (select count(*) from service_orders so
                                   where so.simulacao = false and so.opened_at >= ini and so.first_response_at is null
                                     and so.status::text <> 'resolvido')
    )
  );
end;
$$;
revoke all on function public.admin_atendimento_metricas(int) from public, anon;
grant execute on function public.admin_atendimento_metricas(int) to authenticated, service_role;
