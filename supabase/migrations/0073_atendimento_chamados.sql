-- ─────────────────────────────────────────────────────────────────────────────
-- 0073 — atendimento: chamados (PR 1, sem IA). Idempotente.
--
-- Central de chamados simples, segura e sólida:
--   • chamados / chamado_mensagens / chamado_eventos (auditoria) / chamado_macros;
--   • leitura por RLS: a pessoa vê só os PRÓPRIOS chamados e as mensagens não
--     internas; o admin vê tudo. NINGUÉM grava pela API — toda escrita passa
--     pelo servidor (service role) depois da checagem (abrir, responder,
--     mudar status). Assim a IA do PR 2 também só age pelo servidor;
--   • manutenção reaproveita service_orders (chamado aponta para a ordem);
--   • `simulacao` em tudo (simulador do PR 3) — filas e métricas ignoram;
--   • anexos num bucket PRIVADO ("chamados"), lidos por URL assinada;
--   • prazos gravados na abertura (calculados no código, config/atendimento.ts);
--     varredura a cada 15 min NO BANCO (pg_cron) marca em risco/estourado e,
--     se o segredo estiver no Vault, chama a rota de alertas (pg_net).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tabelas ─────────────────────────────────────────────────────────────────
create sequence if not exists public.chamados_numero_seq start 100;

create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null default nextval('public.chamados_numero_seq') unique,
  numero_publico text generated always as ('VN-' || lpad(numero::text, 6, '0')) stored,
  usuario_id uuid references public.profiles(id) on delete set null,
  -- Visitante (sem conta): só a equipe vê estes campos.
  visitante_email text,
  visitante_nome text,
  tipo text not null check (tipo in ('suporte', 'manutencao', 'seguranca')),
  categoria text not null,
  prioridade text not null check (prioridade in ('p1', 'p2', 'p3', 'p4')),
  status text not null default 'aberto'
    check (status in ('aberto', 'aguardando_usuario', 'aguardando_aprovacao', 'em_andamento', 'resolvido', 'encerrado')),
  canal text not null check (canal in ('site', 'app', 'email')),
  assunto text not null check (length(assunto) between 1 and 140),
  contexto_tipo text check (contexto_tipo in ('pedido', 'contrato', 'anuncio', 'manutencao')),
  contexto_id uuid,
  service_order_id uuid references public.service_orders(id) on delete set null,
  responsavel_tipo text not null default 'humano' check (responsavel_tipo in ('ia', 'humano')),
  responsavel_admin uuid references public.profiles(id) on delete set null,
  prazo_primeira_resposta timestamptz not null,
  prazo_resolucao timestamptz not null,
  primeira_resposta_em timestamptz,
  resolvido_em timestamptz,
  encerrado_em timestamptz,
  nota_satisfacao int check (nota_satisfacao between 1 and 5),
  sla_estado text not null default 'ok' check (sla_estado in ('ok', 'em_risco', 'estourado')),
  alerta_enviado_em timestamptz,
  simulacao boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (usuario_id is not null or visitante_email is not null)
);
create index if not exists chamados_usuario_idx on public.chamados (usuario_id, criado_em desc);
create index if not exists chamados_fila_idx on public.chamados (status, prioridade, prazo_primeira_resposta) where simulacao = false;

create table if not exists public.chamado_mensagens (
  id bigint generated always as identity primary key,
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  autor text not null check (autor in ('usuario', 'ia', 'admin', 'sistema')),
  autor_id uuid references public.profiles(id) on delete set null,
  corpo text not null check (length(corpo) between 1 and 5000),
  anexos jsonb not null default '[]'::jsonb,
  interno boolean not null default false,
  simulacao boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists chamado_mensagens_chamado_idx on public.chamado_mensagens (chamado_id, criado_em);

create table if not exists public.chamado_eventos (
  id bigint generated always as identity primary key,
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  ator_tipo text not null check (ator_tipo in ('usuario', 'ia', 'admin', 'sistema')),
  ator_id uuid references public.profiles(id) on delete set null,
  acao text not null,
  de text,
  para text,
  detalhe text,
  simulacao boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists chamado_eventos_chamado_idx on public.chamado_eventos (chamado_id, criado_em);

create table if not exists public.chamado_macros (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(titulo) between 1 and 80),
  corpo text not null check (length(corpo) between 1 and 3000),
  atualizado_por uuid references public.profiles(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

alter table public.service_orders add column if not exists simulacao boolean not null default false;

-- ── RLS: leitura própria / admin; escrita só pelo servidor ─────────────────
alter table public.chamados enable row level security;
alter table public.chamado_mensagens enable row level security;
alter table public.chamado_eventos enable row level security;
alter table public.chamado_macros enable row level security;

revoke all on public.chamados, public.chamado_mensagens, public.chamado_eventos, public.chamado_macros from anon, authenticated;
grant select on public.chamados, public.chamado_mensagens, public.chamado_eventos, public.chamado_macros to authenticated;
grant all on public.chamados, public.chamado_mensagens, public.chamado_eventos, public.chamado_macros to service_role;
grant usage on sequence public.chamados_numero_seq to service_role;
-- Chamado de visitante (e-mail) não tem dono: só a equipe enxerga (RLS abaixo).

drop policy if exists "dono vê os próprios chamados" on public.chamados;
create policy "dono vê os próprios chamados" on public.chamados for select
  using (usuario_id = auth.uid() or public.is_admin());

drop policy if exists "dono vê mensagens públicas" on public.chamado_mensagens;
create policy "dono vê mensagens públicas" on public.chamado_mensagens for select
  using (
    public.is_admin()
    or (not interno and exists (select 1 from public.chamados c where c.id = chamado_id and c.usuario_id = auth.uid()))
  );

drop policy if exists "admin vê eventos" on public.chamado_eventos;
create policy "admin vê eventos" on public.chamado_eventos for select using (public.is_admin());

drop policy if exists "admin vê macros" on public.chamado_macros;
create policy "admin vê macros" on public.chamado_macros for select using (public.is_admin());

-- Anexos: bucket PRIVADO; o servidor grava e assina URLs curtas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chamados', 'chamados', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Métricas (só admin; ignora simulação) ───────────────────────────────────
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

-- ── Varredura de prazos (a cada 15 min, no banco) ───────────────────────────
-- Marca em risco (≥ 75% do tempo) / estourado na 1ª resposta. Devolve quantos
-- chamados P1/P2 precisam de alerta (a rota de alertas envia e-mail/push).
create or replace function public.atendimento_varrer_prazos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update chamados c
     set sla_estado = case
           when now() >= c.prazo_primeira_resposta then 'estourado'
           when now() - c.criado_em >= 0.75 * (c.prazo_primeira_resposta - c.criado_em) then 'em_risco'
           else 'ok' end,
         atualizado_em = now()
   where c.primeira_resposta_em is null
     and c.status not in ('resolvido', 'encerrado')
     and c.sla_estado is distinct from (case
           when now() >= c.prazo_primeira_resposta then 'estourado'
           when now() - c.criado_em >= 0.75 * (c.prazo_primeira_resposta - c.criado_em) then 'em_risco'
           else 'ok' end);
  select count(*) into n from chamados
   where simulacao = false and primeira_resposta_em is null and status not in ('resolvido', 'encerrado')
     and prioridade in ('p1', 'p2') and sla_estado in ('em_risco', 'estourado')
     and (alerta_enviado_em is null or alerta_enviado_em < now() - interval '1 hour');
  return n;
end;
$$;
revoke all on function public.atendimento_varrer_prazos() from public, anon, authenticated;
grant execute on function public.atendimento_varrer_prazos() to service_role;

-- pg_cron: varre a cada 15 min; se o Vault tiver 'cron_secret' e 'site_url'
-- e o pg_net estiver ligado, chama a rota de alertas. Sem eles, só marca.
create or replace function public.atendimento_tique()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pendentes int;
  segredo text;
  site text;
begin
  pendentes := public.atendimento_varrer_prazos();
  if pendentes = 0 then return; end if;
  begin
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'cron_secret';
    select decrypted_secret into site from vault.decrypted_secrets where name = 'site_url';
    if segredo is not null and site is not null and to_regproc('net.http_get') is not null then
      perform net.http_get(
        url := site || '/api/cron/atendimento',
        headers := jsonb_build_object('Authorization', 'Bearer ' || segredo)
      );
    end if;
  exception when others then
    raise notice 'atendimento_tique: alerta não enviado (%).', sqlerrm;
  end;
end;
$$;
revoke all on function public.atendimento_tique() from public, anon, authenticated;

do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('atendimento-prazos')
    where exists (select 1 from cron.job where jobname = 'atendimento-prazos');
  perform cron.schedule('atendimento-prazos', '*/15 * * * *', 'select public.atendimento_tique();');
exception when others then
  raise notice 'pg_cron indisponível (%). O cron diário da Vercel cobre a varredura.', sqlerrm;
end $cron$;

-- Conferência (rodar depois):
--   select has_table_privilege('anon', 'public.chamados', 'select');                 -- false
--   select jobname, schedule from cron.job where jobname = 'atendimento-prazos';      -- */15
--   select public.admin_atendimento_metricas(30);
