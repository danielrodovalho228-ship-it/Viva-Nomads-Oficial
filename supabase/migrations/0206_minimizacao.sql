-- 0206 — Minimização e eliminação automática de dados, fase 1 (Prompt 58). Reaplicar é seguro.
--
--  1. eliminacoes_registro: o LIVRO DE ELIMINAÇÕES. Cada eliminação real (apagar ou anonimizar) grava origem, id, tipo,
--     motivo e data — NUNCA o conteúdo eliminado. Escrita só pelo servidor (service role); leitura só pelo admin.
--     É a base para reaplicar as eliminações depois de restaurar um backup.
--  2. eliminacoes_simulado: o relatório "o que seria apagado hoje" (item, guardados, vencidos, prazo, base), um por dia
--     e item do inventário. Só contagem, nunca ids nem conteúdo. Prazo pendente (item 13) → vencidos = 0.
--  3. eliminacoes_alertas: falha numa eliminação não para as outras; vira alerta no admin.
--  4. "Só o veredito": o arquivo do documento sai e a linha fica com a decisão — os caminhos passam a aceitar nulo e
--     ganham a data da eliminação (documentos_inquilino, qualification_checklists, property_ownership_checks).
--  5. fotos_anuncio_hash: o hash perceptual de cada foto do anúncio, calculado no servidor. SEM chave estrangeira:
--     sobrevive à remoção do anúncio (exceção aprovada, antifraude). Só o hash e os ids, nenhuma imagem.

-- ── 1. Livro ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.eliminacoes_registro (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (char_length(origem) between 1 and 80),        -- tabela ou bucket
  ref_id text not null check (char_length(ref_id) between 1 and 300),       -- id da linha ou caminho do arquivo
  tipo text not null check (char_length(tipo) between 1 and 80),            -- item do inventário (ex.: inquilino-docs/arquivo)
  motivo text not null check (motivo in ('prazo', 'pedido_titular', 'decisao')),
  modo text not null check (modo in ('apagado', 'anonimizado')),
  teste boolean not null default false,                                     -- dado de conta de teste (contado à parte)
  eliminado_em timestamptz not null default now()
);
create index if not exists eliminacoes_registro_quando_idx on public.eliminacoes_registro (eliminado_em desc);
create index if not exists eliminacoes_registro_origem_ref_idx on public.eliminacoes_registro (origem, ref_id);

-- ── 2. Relatório do modo simulado ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.eliminacoes_simulado (
  dia date not null,
  item text not null check (char_length(item) between 1 and 80),
  guardados integer check (guardados is null or guardados >= 0),             -- quanto existe hoje (null: não contado)
  vencidos integer not null default 0 check (vencidos >= 0),                -- quanto sairia hoje pelo prazo
  vencidos_teste integer not null default 0 check (vencidos_teste >= 0),     -- contas de teste, à parte
  real boolean not null default false,                                      -- true: saiu de verdade (fase 1)
  prazo text not null,
  base text not null,
  gerado_em timestamptz not null default now(),
  primary key (dia, item)
);

-- ── 3. Alertas ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.eliminacoes_alertas (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  erro text not null check (char_length(erro) <= 500),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists eliminacoes_alertas_abertos_idx on public.eliminacoes_alertas (criado_em desc) where resolvido_em is null;

-- ── RLS: leitura só do admin; escrita só pelo servidor ───────────────────────────────────────────────────────────
alter table public.eliminacoes_registro enable row level security;
alter table public.eliminacoes_simulado enable row level security;
alter table public.eliminacoes_alertas enable row level security;
drop policy if exists "eliminacoes_registro: admin lê" on public.eliminacoes_registro;
create policy "eliminacoes_registro: admin lê" on public.eliminacoes_registro for select to authenticated using (public.is_admin());
drop policy if exists "eliminacoes_simulado: admin lê" on public.eliminacoes_simulado;
create policy "eliminacoes_simulado: admin lê" on public.eliminacoes_simulado for select to authenticated using (public.is_admin());
drop policy if exists "eliminacoes_alertas: admin lê" on public.eliminacoes_alertas;
create policy "eliminacoes_alertas: admin lê" on public.eliminacoes_alertas for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.eliminacoes_registro, public.eliminacoes_simulado, public.eliminacoes_alertas from anon, authenticated;

-- ── 4. Só o veredito ─────────────────────────────────────────────────────────────────────────────────────────────
alter table public.documentos_inquilino alter column caminho drop not null;
alter table public.documentos_inquilino add column if not exists arquivo_eliminado_em timestamptz;
alter table public.qualification_checklists add column if not exists document_eliminado_em timestamptz;
alter table public.property_ownership_checks alter column arquivo_path drop not null;
alter table public.property_ownership_checks add column if not exists arquivo_eliminado_em timestamptz;

-- ── 5. Hash das fotos do anúncio (antifraude) ────────────────────────────────────────────────────────────────────
create table if not exists public.fotos_anuncio_hash (
  id uuid primary key default gen_random_uuid(),
  property_id uuid,                 -- sem FK de propósito: o hash fica depois da remoção do anúncio (preenchido ao ligar a foto)
  owner_id uuid not null,           -- idem
  caminho text not null check (char_length(caminho) <= 200),   -- caminho da foto no bucket (dono/uuid.webp)
  hash text not null check (hash ~ '^[0-9a-f]{16}$'),
  criado_em timestamptz not null default now()
);
create index if not exists fotos_anuncio_hash_hash_idx on public.fotos_anuncio_hash (hash);
create index if not exists fotos_anuncio_hash_imovel_idx on public.fotos_anuncio_hash (property_id);
create unique index if not exists fotos_anuncio_hash_caminho_idx on public.fotos_anuncio_hash (caminho);
alter table public.fotos_anuncio_hash enable row level security;
drop policy if exists "fotos_anuncio_hash: admin lê" on public.fotos_anuncio_hash;
create policy "fotos_anuncio_hash: admin lê" on public.fotos_anuncio_hash for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.fotos_anuncio_hash from anon, authenticated;
