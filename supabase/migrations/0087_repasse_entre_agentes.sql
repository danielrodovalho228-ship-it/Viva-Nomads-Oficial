-- 0087 — Repasse entre agentes (Central de Agentes).
-- Achado com "para":"<slug>" vira ordem para esse agente (origem = quem achou).
-- Quando o destinatário fecha a ordem (registrar_ronda p_ordens), a resposta
-- volta para quem repassou como uma ordem de retorno (que não gera outro retorno).
-- O disparo na hora (P0/P1) é feito pelo servidor do site, que tem os tokens.
-- Só colunas novas (nullable) + registrar_ronda com o MESMO formato (create or
-- replace, sem DROP). RLS e grants da 0078 seguem valendo. Sem NOTICE.

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'agentes_ordens' and column_name = 'origem_slug') then
    alter table public.agentes_ordens
      add column origem_slug text references public.agentes(slug),
      add column origem_ronda uuid references public.agentes_rondas(id) on delete set null,
      add column retorno_de uuid references public.agentes_ordens(id) on delete set null,
      add column prioridade text check (prioridade is null or prioridade in ('P0','P1','P2','P3'));
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'agentes_ordens_repasse') then
    create index agentes_ordens_repasse on public.agentes_ordens (criada_em desc) where origem_slug is not null;
  end if;
end;
$$;

create or replace function public.registrar_ronda(
  p_slug text, p_inicio timestamptz, p_fim timestamptz, p_status text,
  p_resumo text, p_achados jsonb default '[]'::jsonb, p_ordens uuid[] default '{}', p_link text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_nome text;
  v_resumo text := left(coalesce(p_resumo, ''), 4000);
  o record;
  a record;
begin
  insert into public.agentes_rondas (agente_slug, iniciada_em, concluida_em, status, resumo, achados, ordens_atendidas, link_sessao)
  values (p_slug, coalesce(p_inicio, now()), coalesce(p_fim, now()), p_status, v_resumo, coalesce(p_achados,'[]'::jsonb), coalesce(p_ordens,'{}'), p_link)
  returning id into v_id;
  select nome into v_nome from public.agentes where slug = p_slug;

  -- Fecha as ordens atendidas e guarda o resumo como resposta.
  for o in
    update public.agentes_ordens
       set status = 'concluida', atualizada_em = now(), resposta = coalesce(resposta, nullif(v_resumo, ''))
     where id = any(coalesce(p_ordens,'{}')) and agente_slug = p_slug and status in ('pendente','lida')
    returning id, origem_slug, retorno_de, texto
  loop
    -- A resposta volta para quem repassou (uma vez; retorno não gera retorno).
    if o.origem_slug is not null and o.retorno_de is null and o.origem_slug <> p_slug
       and exists (select 1 from public.agentes g where g.slug = o.origem_slug and g.status = 'ativo') then
      insert into public.agentes_ordens (agente_slug, texto, origem_slug, origem_ronda, retorno_de, criado_por)
      values (o.origem_slug,
              left(format('Retorno de %s sobre o que você repassou ("%s"): %s%s',
                          coalesce(v_nome, p_slug), left(o.texto, 300),
                          coalesce(nullif(v_resumo, ''), 'sem resumo'),
                          case when p_link is not null then ' ' || p_link else '' end), 4000),
              p_slug, v_id, o.id, null);
    end if;
  end loop;

  -- Achado com "para" vira ordem para o agente ATIVO indicado (até 10 por ronda).
  for a in
    select e.value as achado, g.slug as destino,
           case when upper(e.value->>'prioridade') in ('P0','P1','P2','P3') then upper(e.value->>'prioridade') end as prio
      from jsonb_array_elements(case when jsonb_typeof(p_achados) = 'array' then p_achados else '[]'::jsonb end) with ordinality e(value, n)
      join public.agentes g on g.slug = lower(btrim(e.value->>'para')) and g.status = 'ativo' and g.slug <> p_slug
     where jsonb_typeof(e.value) = 'object'
     order by e.n
     limit 10
  loop
    insert into public.agentes_ordens (agente_slug, texto, origem_slug, origem_ronda, prioridade, criado_por)
    values (a.destino,
            left(format('Repasse de %s (%s): %s%s', coalesce(v_nome, p_slug), coalesce(a.prio, 'sem prioridade'),
                        coalesce(nullif(btrim(a.achado->>'titulo'), ''), nullif(btrim(a.achado->>'detalhe'), ''), 'achado sem título'),
                        case when nullif(btrim(a.achado->>'titulo'), '') is not null and nullif(btrim(a.achado->>'detalhe'), '') is not null
                             then ' — ' || btrim(a.achado->>'detalhe') else '' end), 4000),
            p_slug, v_id, a.prio, null);
  end loop;
  return v_id;
end $$;

revoke all on function public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text) from public, anon, authenticated;
grant execute on function public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text) to service_role;

-- Viva: a rotina "Viva · Plantão de chamados" (de hora em hora, 07:23–23:23 Brasília)
-- passa a ser a dela — "Executar agora" pode acordá-la (com AGENTE_TOKEN_VIVA).
update public.agentes set trigger_id = 'trig_01HrZe3NpeM8ntv4bZtePisD' where slug = 'viva' and trigger_id is null;
