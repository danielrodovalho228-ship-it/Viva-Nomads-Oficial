-- Viva Nomads — aplicar 0353 (E1086). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- Cada proposta aceita gera o SEU contrato: o banco passa a aceitar um contrato, uma reserva de geração e uma cobrança
-- da taxa de serviço por PROPOSTA (antes: por candidatura, e a candidatura é uma só por morador + imóvel).
-- Nenhum contrato muda. As reservas/cobranças que já existem ficam ligadas à proposta do contrato delas.
-- Rollback: supabase/producao/rollback/0353_rollback.sql
begin;
set local lock_timeout = '5s';

-- 1. contratos: um por PROPOSTA. O índice "um por candidatura" (0057) sai. Contrato sem proposta (fechamento direto
--    da candidatura) continua um só por candidatura pela regra do servidor; a sobreposição de datas no mesmo imóvel
--    continua recusada pelo banco (0176).
drop index if exists public.contratos_lead_id_key;
create unique index if not exists contratos_proposta_id_key
  on public.contratos (proposta_id) where proposta_id is not null;

-- 2. cobrancas_fechamento (a reserva da geração do contrato e a cobrança da taxa de serviço): a proposta entra na chave.
--    As linhas que já existem ficam com a proposta do contrato da candidatura delas (até aqui havia um só por
--    candidatura); as de candidatura ainda sem contrato, com a proposta acordada mais recente (a regra da 0299).
--    O preenchimento roda UMA vez: só quando a coluna ainda não existe.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'cobrancas_fechamento' and column_name = 'proposta_id') then
    alter table public.cobrancas_fechamento
      add column if not exists proposta_id uuid references public.propostas (id) on delete cascade;
    update public.cobrancas_fechamento cf
       set proposta_id = c.proposta_id
      from public.contratos c
     where c.lead_id = cf.lead_id and c.proposta_id is not null;
    update public.cobrancas_fechamento cf
       set proposta_id = (
         select p.id from public.propostas p
          where p.lead_id = cf.lead_id and p.status in ('aceita', 'em_contrato', 'contrato_assinado')
          order by p.aceita_em desc nulls last
          limit 1)
     where cf.proposta_id is null
       and not exists (select 1 from public.contratos c where c.lead_id = cf.lead_id);
  end if;
end $$;
comment on column public.cobrancas_fechamento.proposta_id is 'E1086: a proposta (orçamento ORC-…) a que esta reserva/cobrança pertence. Vazio = fechamento sem proposta.';

alter table public.cobrancas_fechamento drop constraint if exists cobrancas_fechamento_pkey;
alter table public.cobrancas_fechamento add column if not exists id uuid not null default gen_random_uuid();
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.cobrancas_fechamento'::regclass and contype = 'p') then
    alter table public.cobrancas_fechamento add constraint cobrancas_fechamento_id_pkey primary key (id);
  end if;
end $$;
create unique index if not exists cobrancas_fechamento_chave
  on public.cobrancas_fechamento (lead_id, tipo, coalesce(proposta_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 3. Painel do admin: a taxa paga junta com o contrato DELA (candidatura + proposta). Com dois contratos na mesma
--    candidatura, o join só pela candidatura contaria a taxa duas vezes. A função é a da 0266; muda só essa linha.
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
      left join contratos c on c.lead_id = cf.lead_id and c.proposta_id is not distinct from cf.proposta_id
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

insert into supabase_migrations.schema_migrations (version, name)
select '20261122000353', '0353_contrato_por_proposta_e1086'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261122000353');
commit;
