-- Viva Nomads — aplicar 0274 (E335: título real das ordens encaminhadas entre agentes). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0274_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E335: o achado encaminhado vira ordem com TÍTULO REAL. Os agentes escrevem o achado com chaves variadas
-- (assunto, achado, texto, acao, onde…), mas a 0087 só lia "titulo" e "detalhe": 96 ordens do Moacir viraram
-- "achado sem título". Aqui: (1) as duas funções que tiram título e detalhe do achado; (2) registrar_ronda usa as
-- duas (mesma assinatura, mesmo formato "Encaminhado por X (P1): título — detalhe"); (3) as ordens antigas sem
-- título ganham o título do achado de origem (a cópia do texto anterior fica em agentes_ordens_titulo_0274, para o
-- rollback). Nada é apagado.

create or replace function public.agente_achado_titulo(p jsonb) returns text
language sql immutable as $$
  select case when jsonb_typeof(p) <> 'object' then null else
    coalesce(nullif(btrim(p->>'titulo'), ''), nullif(btrim(p->>'assunto'), ''), nullif(btrim(p->>'achado'), ''),
             nullif(btrim(p->>'texto'), ''), nullif(btrim(p->>'resumo'), '')) end
$$;

create or replace function public.agente_achado_detalhe(p jsonb) returns text
language sql immutable as $$
  select case when jsonb_typeof(p) <> 'object' then null else
    coalesce(nullif(btrim(p->>'detalhe'), ''), nullif(btrim(p->>'acao'), ''), nullif(btrim(p->>'onde'), '')) end
$$;

-- "título — detalhe"; só um deles quando falta o outro; nada → 'achado sem título' (como antes).
create or replace function public.agente_achado_texto(p jsonb) returns text
language sql immutable as $$
  select coalesce(public.agente_achado_titulo(p) || coalesce(' — ' || public.agente_achado_detalhe(p), ''),
                  public.agente_achado_detalhe(p), 'achado sem título')
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
    -- A resposta volta para quem encaminhou (uma vez; retorno não gera retorno).
    if o.origem_slug is not null and o.retorno_de is null and o.origem_slug <> p_slug
       and exists (select 1 from public.agentes g where g.slug = o.origem_slug and g.status = 'ativo') then
      insert into public.agentes_ordens (agente_slug, texto, origem_slug, origem_ronda, retorno_de, criado_por)
      values (o.origem_slug,
              left(format('Retorno de %s sobre o que você encaminhou ("%s"): %s%s',
                          coalesce(v_nome, p_slug), left(o.texto, 300),
                          coalesce(nullif(v_resumo, ''), 'sem resumo'),
                          case when p_link is not null then ' ' || p_link else '' end), 4000),
              p_slug, v_id, o.id, null);
    end if;
  end loop;

  -- Achado com "para" vira ordem para o agente ATIVO indicado (até 10 por ronda). E335: título pelas chaves reais.
  for a in
    select e.value as achado, g.slug as destino,
           case when upper(coalesce(e.value->>'prioridade', e.value->>'prio')) in ('P0','P1','P2','P3')
                then upper(coalesce(e.value->>'prioridade', e.value->>'prio')) end as prio
      from jsonb_array_elements(case when jsonb_typeof(p_achados) = 'array' then p_achados else '[]'::jsonb end) with ordinality e(value, n)
      join public.agentes g on g.slug = lower(btrim(e.value->>'para')) and g.status = 'ativo' and g.slug <> p_slug
     where jsonb_typeof(e.value) = 'object'
     order by e.n
     limit 10
  loop
    insert into public.agentes_ordens (agente_slug, texto, origem_slug, origem_ronda, prioridade, criado_por)
    values (a.destino,
            left(format('Encaminhado por %s (%s): %s', coalesce(v_nome, p_slug), coalesce(a.prio, 'sem prioridade'),
                        public.agente_achado_texto(a.achado)), 4000),
            p_slug, v_id, a.prio, null);
  end loop;
  return v_id;
end $$;

revoke all on function public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text) from public, anon, authenticated;
grant execute on function public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text) to service_role;

-- Cópia do texto anterior das ordens retituladas (só para o rollback; só o serviço lê).
create table if not exists public.agentes_ordens_titulo_0274 (id uuid primary key, texto_antes text not null);
alter table public.agentes_ordens_titulo_0274 enable row level security;
revoke all on public.agentes_ordens_titulo_0274 from anon, authenticated;

-- As ordens antigas "achado sem título": o título vem dos achados da ronda de origem endereçados ao mesmo agente
-- (os que não tinham titulo/detalhe — os únicos que viravam "achado sem título"). Mais de um → juntos, com " · ".
with alvo as (
  select o.id, o.texto, o.origem_ronda, o.agente_slug
    from public.agentes_ordens o
   where o.texto ~ ': achado sem título$' and o.origem_ronda is not null
),
titulos as (
  select al.id,
         string_agg(public.agente_achado_texto(e.value), ' · ' order by e.n) as novo
    from alvo al
    join public.agentes_rondas r on r.id = al.origem_ronda
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.achados) = 'array' then r.achados else '[]'::jsonb end) with ordinality e(value, n)
   where jsonb_typeof(e.value) = 'object'
     and lower(btrim(e.value->>'para')) = al.agente_slug
     and nullif(btrim(e.value->>'titulo'), '') is null and nullif(btrim(e.value->>'detalhe'), '') is null
     and public.agente_achado_texto(e.value) <> 'achado sem título'
   group by al.id
),
copia as (
  insert into public.agentes_ordens_titulo_0274 (id, texto_antes)
  select al.id, al.texto from alvo al join titulos t on t.id = al.id
  on conflict (id) do nothing
  returning id
)
update public.agentes_ordens o
   set texto = left(left(o.texto, length(o.texto) - length('achado sem título')) || t.novo, 4000)
  from titulos t
 where o.id = t.id and o.texto ~ ': achado sem título$';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261101000274', '0274_agentes_titulo_achado', array['-- conteúdo em supabase/migrations/0274_agentes_titulo_achado.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261101000274');
commit;
