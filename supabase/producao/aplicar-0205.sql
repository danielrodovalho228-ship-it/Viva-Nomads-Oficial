-- Viva Nomads — aplicar 0205 (Internet medida no imóvel — Prompt 57). Idempotente. Rollback: supabase/producao/rollback/0205_rollback.sql.
begin;
set local lock_timeout = '5s';
-- 0205 — Internet medida no imóvel (Prompt 57, roteiro B3). Reaplicar é seguro.
--
--  1. internet_medicoes: cada medição (dono no cadastro/edição; morador na conferência de entrada). O navegador mede e
--     manda o resultado; o SERVIDOR confere sessão, papel, limite (6 por imóvel por dia) e a distância ao imóvel, e
--     grava. Guarda só a distância em metros — nunca a coordenada do aparelho. Escrita só pelo servidor (service role).
--     Leitura: o dono lê as do imóvel; o morador lê as próprias; o admin lê tudo.
--  2. internet_medida_publica: SÓ a última medição VALIDADA do DONO dentro da validade, de imóvel publicado →
--     download, upload, latência e data. Nada de distância, usuário ou medição de morador. Função security definer de
--     colunas fixas + view security_invoker (padrão da 0077).
--  3. internet_medicoes_aviso: marca de quando o dono foi avisado "Meça de novo" (uma vez por medição).
--  properties.internet_mbps continua sendo o INFORMADO pelo dono; a medição nunca o sobrescreve.

-- ── 1. Medições ──────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.internet_medicoes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null check (papel in ('dono', 'morador')),
  download_mbps numeric(8, 1) not null check (download_mbps > 0 and download_mbps <= 20000),
  upload_mbps numeric(8, 1) not null check (upload_mbps > 0 and upload_mbps <= 20000),
  latencia_ms integer not null check (latencia_ms > 0 and latencia_ms <= 10000),
  distancia_m integer check (distancia_m is null or distancia_m >= 0),
  validada boolean not null default false,
  motivo_invalida text check (motivo_invalida is null or motivo_invalida in ('sem_permissao', 'longe', 'sem_coordenadas_imovel', 'sem_confirmacao_wifi')),
  origem text not null check (origem in ('cadastro', 'edicao', 'conferencia_entrada')),
  medido_em timestamptz not null default now(),
  valido_ate timestamptz not null,
  avisado_remedir_em timestamptz,
  constraint internet_medicoes_validada_sem_motivo check (validada = (motivo_invalida is null)),
  constraint internet_medicoes_morador_na_conferencia check (papel = 'dono' or origem = 'conferencia_entrada'),
  constraint internet_medicoes_validade check (valido_ate > medido_em)
);
create index if not exists internet_medicoes_imovel_idx on public.internet_medicoes (property_id, medido_em desc);
create index if not exists internet_medicoes_usuario_idx on public.internet_medicoes (user_id);

alter table public.internet_medicoes enable row level security;
drop policy if exists "internet_medicoes: dono lê as do imóvel" on public.internet_medicoes;
create policy "internet_medicoes: dono lê as do imóvel" on public.internet_medicoes for select to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
drop policy if exists "internet_medicoes: morador lê as próprias" on public.internet_medicoes;
create policy "internet_medicoes: morador lê as próprias" on public.internet_medicoes for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "internet_medicoes: admin lê" on public.internet_medicoes;
create policy "internet_medicoes: admin lê" on public.internet_medicoes for select to authenticated
  using (public.is_admin());
-- Sem policy de escrita: só o servidor (service role) grava.
revoke insert, update, delete, truncate on public.internet_medicoes from anon, authenticated;

-- ── 2. Leitura pública ───────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.internet_medida_publica_lista()
returns table (property_id uuid, download_mbps numeric, upload_mbps numeric, latencia_ms integer, medido_em timestamptz, valido_ate timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (m.property_id) m.property_id, m.download_mbps, m.upload_mbps, m.latencia_ms, m.medido_em, m.valido_ate
    from public.internet_medicoes m
    join public.properties p on p.id = m.property_id
   where m.papel = 'dono' and m.validada and m.valido_ate > now() and p.status = 'active'
   order by m.property_id, m.medido_em desc
$$;
revoke all on function public.internet_medida_publica_lista() from public;
grant execute on function public.internet_medida_publica_lista() to anon, authenticated, service_role;

create or replace view public.internet_medida_publica
  with (security_invoker = on)
as
  select l.property_id, l.download_mbps, l.upload_mbps, l.latencia_ms, l.medido_em, l.valido_ate
    from public.internet_medida_publica_lista() l;
revoke insert, update, delete, truncate, references, trigger on public.internet_medida_publica from anon, authenticated;
grant select on public.internet_medida_publica to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261022000205', '0205_internet_medida',
       array['-- conteúdo em supabase/migrations/0205_internet_medida.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261022000205');
commit;
