-- 0217 — Prompt 50: ativação por papel e a análise humana da verificação de identidade.
-- O funil NÃO ganha tabela: sai do que já existe (eventos da sessão, profiles, leads/pedidos_moradia, properties,
-- parceiro_solicitacoes, tenant_verifications), sempre sem contas de teste. Só o servidor grava; a RLS abre a leitura
-- à própria pessoa e à equipe (duas etapas).
--
--   1. ativacoes: a data em que cada papel ATIVOU (morador = 1º pedido enviado; proprietário = 1º anúncio publicado;
--      parceiro = 1º pedido aceito). Uma linha por pessoa e papel, gravada uma vez e nunca desfeita.
--   2. verificacao_revisoes: a 2ª reprovação automática da verificação vai para uma pessoa da equipe, com o motivo.

-- ── 1. Ativação ─────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.ativacoes (
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null check (papel in ('morador', 'proprietario', 'parceiro')),
  ativado_em timestamptz not null default now(),
  primary key (user_id, papel)
);
create index if not exists ativacoes_papel_data on public.ativacoes (papel, ativado_em desc);
alter table public.ativacoes enable row level security;
revoke all on public.ativacoes from public, anon, authenticated;
grant select on public.ativacoes to authenticated;
grant all on public.ativacoes to service_role;
drop policy if exists ativacoes_le on public.ativacoes;
create policy ativacoes_le on public.ativacoes for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ── 2. Verificação: análise humana depois da 2ª reprovação automática ──────────────────────────────────────────
create table if not exists public.verificacao_revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (motivo in ('foto_escura', 'documento_ilegivel', 'documento_nao_reconhecido', 'selfie_nao_confere',
                                         'prova_de_vida', 'nome_nao_confere', 'cpf_nao_confere', 'em_analise')),
  reprovacoes smallint not null default 2 check (reprovacoes >= 2),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references auth.users (id) on delete set null,
  resultado text check (resultado is null or resultado in ('aprovada', 'recusada')),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  constraint verificacao_revisoes_decisao check ((resultado is null) = (decidido_em is null))
);
create unique index if not exists verificacao_revisoes_aberta on public.verificacao_revisoes (user_id) where decidido_em is null;
alter table public.verificacao_revisoes enable row level security;
revoke all on public.verificacao_revisoes from public, anon, authenticated;
grant select on public.verificacao_revisoes to authenticated;
grant all on public.verificacao_revisoes to service_role;
drop policy if exists verificacao_revisoes_le on public.verificacao_revisoes;
create policy verificacao_revisoes_le on public.verificacao_revisoes for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
