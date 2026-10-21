-- 0191 — Resiliência 2 (cópia noturna cifrada no Google Drive + teste de restauração semanal): tabela de controle
-- public.backups_execucoes, uma linha por execução das Actions "Backup noturno" (tipo 'copia') e "Teste de
-- restauração" (tipo 'drill'). SEM dado de usuário: datas, tamanhos, contagens, OK/falha e um motivo curto (sem
-- e-mail, nome, CPF nem nome de arquivo). Alimenta o cartão "Backup e recuperação" do /admin e é o aviso no admin
-- quando algo falha (ok = false). RLS: só o admin lê; quem grava é o servidor (service_role) ou a Action (dona da
-- tabela). Idempotente. Rollback: supabase/producao/rollback/0191_rollback.sql.
create table if not exists public.backups_execucoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('copia', 'drill')),
  inicio timestamptz not null,
  fim timestamptz,
  ok boolean not null,
  motivo text check (motivo is null or (char_length(motivo) <= 300 and position('@' in motivo) = 0)),
  bytes_banco bigint check (bytes_banco is null or bytes_banco >= 0),
  objetos_storage bigint check (objetos_storage is null or objetos_storage >= 0),
  bytes_storage bigint check (bytes_storage is null or bytes_storage >= 0),
  duracao_restauracao_s integer check (duracao_restauracao_s is null or duracao_restauracao_s >= 0),
  -- Total usado na pasta do Drive (cifrada), medido pela cópia. Acima de 10 GB o cartão sugere o Google One.
  bytes_pasta bigint check (bytes_pasta is null or bytes_pasta >= 0),
  criado_em timestamptz not null default now(),
  constraint backups_execucoes_fim_depois check (fim is null or fim >= inicio)
);
create index if not exists backups_execucoes_tipo_inicio_idx on public.backups_execucoes (tipo, inicio desc);

alter table public.backups_execucoes enable row level security;
revoke all on public.backups_execucoes from public, anon, authenticated;
grant select on public.backups_execucoes to authenticated;
grant all on public.backups_execucoes to service_role;

-- "to authenticated" (nunca o role public): is_admin() não é executável pelo anon (0084/2, 0189).
drop policy if exists backups_execucoes_admin_le on public.backups_execucoes;
create policy backups_execucoes_admin_le on public.backups_execucoes for select to authenticated
  using (public.is_admin());

comment on table public.backups_execucoes is 'Cópia noturna cifrada e teste de restauração semanal (Resiliência 2). Sem dado de usuário: datas, tamanhos, contagens, OK e motivo curto.';
