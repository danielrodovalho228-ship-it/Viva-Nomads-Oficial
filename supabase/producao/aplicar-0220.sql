-- Viva Nomads — aplicar 0220 (Sair da Viva — Prompt 51, fase 1). Idempotente. Rollback: supabase/producao/rollback/0220_rollback.sql.
begin;
set local lock_timeout = '5s';
-- ── 1. Pausa da conta ───────────────────────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists pausada_em timestamptz;
-- O que a pausa tirou do ar (para a reativação devolver só isso, nunca o que o dono pausou por conta própria).
alter table public.properties add column if not exists pausado_pela_conta boolean not null default false;
alter table public.parceiros add column if not exists pausado_pela_conta boolean not null default false;

-- ── 2. Motivo da saída (opcional; o texto livre só a equipe lê; as estatísticas saem sem identificação) ───────────
create table if not exists public.saidas_motivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  papel text not null check (papel in ('morador', 'proprietario', 'parceiro')),
  nivel text not null check (nivel in ('pausar', 'apagar', 'encerrar')),
  motivo text check (motivo is null or char_length(motivo) <= 40),
  detalhe text check (detalhe is null or char_length(detalhe) <= 40),
  texto_livre text check (texto_livre is null or char_length(texto_livre) <= 1000),
  ajuda_oferecida text check (ajuda_oferecida is null or ajuda_oferecida in ('falar_com_pessoa', 'melhorar_anuncio', 'ajuda_por_mensagem')),
  ajuda_aceita boolean not null default false,
  revertida boolean not null default false,
  teste boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists saidas_motivos_data on public.saidas_motivos (criado_em desc);
alter table public.saidas_motivos enable row level security;
revoke all on public.saidas_motivos from public, anon, authenticated;
grant select on public.saidas_motivos to authenticated;
grant all on public.saidas_motivos to service_role;
drop policy if exists saidas_motivos_le on public.saidas_motivos;
create policy saidas_motivos_le on public.saidas_motivos for select to authenticated using (public.is_admin());

-- ── 3. Correções do painel de qualidade (motivo > 3 em 30 dias; dono e prazo obrigatórios; fechar exige ligação) ──
create table if not exists public.qualidade_correcoes (
  id uuid primary key default gen_random_uuid(),
  papel text not null check (papel in ('morador', 'proprietario', 'parceiro')),
  motivo text not null check (char_length(motivo) <= 40),
  ocorrencias integer not null check (ocorrencias > 0),
  dono text check (dono is null or char_length(dono) between 2 and 80),
  prazo date,
  criada_em timestamptz not null default now(),
  fechada_em timestamptz,
  fechada_por uuid references auth.users (id) on delete set null,
  ligacao text check (ligacao is null or char_length(ligacao) <= 300),
  constraint qualidade_correcoes_fechar check (fechada_em is null or (ligacao is not null and dono is not null and prazo is not null))
);
create unique index if not exists qualidade_correcoes_aberta on public.qualidade_correcoes (papel, motivo) where fechada_em is null;
alter table public.qualidade_correcoes enable row level security;
revoke all on public.qualidade_correcoes from public, anon, authenticated;
grant select on public.qualidade_correcoes to authenticated;
grant all on public.qualidade_correcoes to service_role;
drop policy if exists qualidade_correcoes_le on public.qualidade_correcoes;
create policy qualidade_correcoes_le on public.qualidade_correcoes for select to authenticated using (public.is_admin());

-- ── 4. Denúncia de anúncio (uma por conta por anúncio; não tira da busca sozinha) ────────────────────────────────
create table if not exists public.denuncias_anuncio (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (motivo in ('fotos_falsas', 'imovel_nao_existe', 'pagamento_fora', 'conteudo_improprio', 'outro')),
  texto text check (texto is null or char_length(texto) <= 1000),
  status text not null default 'recebida' check (status in ('recebida', 'em_analise', 'resolvida')),
  chamado_numero text check (chamado_numero is null or char_length(chamado_numero) <= 40),
  teste boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (property_id, user_id)
);
create index if not exists denuncias_anuncio_data on public.denuncias_anuncio (criado_em desc);
alter table public.denuncias_anuncio enable row level security;
revoke all on public.denuncias_anuncio from public, anon, authenticated;
grant select on public.denuncias_anuncio to authenticated;
grant all on public.denuncias_anuncio to service_role;
drop policy if exists denuncias_anuncio_le on public.denuncias_anuncio;
create policy denuncias_anuncio_le on public.denuncias_anuncio for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000220', '0220_sair_da_viva',
       array['-- conteúdo em supabase/migrations/0220_sair_da_viva.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000220');
commit;
