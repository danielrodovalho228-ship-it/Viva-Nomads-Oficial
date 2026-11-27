-- Viva Nomads — rollback da 0353 (E1086): volta a "um contrato e uma reserva por candidatura". Nunca roda sozinho.
-- SÓ funciona enquanto nenhuma candidatura tiver dois contratos ou duas reservas do mesmo tipo: com eles, os índices
-- únicos antigos não se criam e o script para sem mudar nada (está entre begin e commit). Nesse caso NÃO apague
-- contrato nem cobrança para "fazer caber": fale com o Gerente.
begin;
set local lock_timeout = '5s';
create unique index if not exists contratos_lead_id_key on public.contratos (lead_id) where lead_id is not null;
drop index if exists public.contratos_proposta_id_key;
drop index if exists public.cobrancas_fechamento_chave;
alter table public.cobrancas_fechamento drop constraint if exists cobrancas_fechamento_id_pkey;
alter table public.cobrancas_fechamento add constraint cobrancas_fechamento_pkey primary key (lead_id, tipo);
alter table public.cobrancas_fechamento drop column if exists id;
alter table public.cobrancas_fechamento drop column if exists proposta_id;

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
       and e.trafego = 'real'
  ),
  eventos_fora as (
    select count(*) as n
      from eventos e
     where e.criado_em >= ini and e.criado_em < fim
       and (k is null or e.cidade_chave = k)
       and (e.trafego <> 'real' or (e.usuario_id is not null and public.admin_eh_teste(e.usuario_id)))
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
    -- E288-B: eventos de teste (suíte automática, contas is_teste) que ficaram fora da contagem
    'eventos_teste_fora', (select n from eventos_fora),
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
delete from supabase_migrations.schema_migrations where version = '20261122000353';
commit;
