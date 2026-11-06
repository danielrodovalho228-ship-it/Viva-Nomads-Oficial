-- Viva Nomads — aplicar 0310 (E637: prazos da caução, atrás da chave CAUCAO_PRAZOS_ATIVA desligada). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0310_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E637: duas tabelas novas (RLS: as partes do contrato leem; só o servidor escreve). Nada existente é alterado e nada as lê nem grava
-- enquanto a chave CAUCAO_PRAZOS_ATIVA estiver desligada. Comentários completos em supabase/migrations/0310_caucao_prazos_e637.sql.
create table if not exists public.caucao_prazos (
  contrato_id uuid primary key references public.contratos (id) on delete cascade,
  saida_em date not null,
  parecer_em timestamptz,
  liberacao_integral_em timestamptz,
  liberacao_motivo text check (liberacao_motivo is null or liberacao_motivo in ('silencio', 'parecer_sem_desconto')),
  avisou_liberacao_em timestamptz,
  devolvida_em timestamptz,
  pendencia_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint caucao_prazos_liberacao_coerente check ((liberacao_integral_em is null) = (liberacao_motivo is null))
);
create index if not exists caucao_prazos_pendentes_idx on public.caucao_prazos (saida_em) where devolvida_em is null;
create index if not exists caucao_prazos_pendencia_idx on public.caucao_prazos (contrato_id) where pendencia_em is not null and devolvida_em is null;

create table if not exists public.caucao_desconto_itens (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  categoria text not null check (categoria in ('dano', 'sujeira_excessiva', 'item_faltando')),
  comodo text not null check (char_length(comodo) between 1 and 80),
  descricao text check (descricao is null or char_length(descricao) <= 600),
  valor numeric(12, 2) not null,
  foto_entrada_path text,
  foto_saida_path text,
  comprovante_path text,
  status text not null default 'proposto' check (status in ('proposto', 'aceito', 'contestado')),
  contestacao_texto text check (contestacao_texto is null or char_length(contestacao_texto) <= 600),
  contestado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint caucao_desconto_itens_prova check (
    valor > 0 and foto_entrada_path is not null and foto_saida_path is not null and comprovante_path is not null
  ),
  constraint caucao_desconto_itens_contestado check (status <> 'contestado' or contestado_em is not null)
);
create index if not exists caucao_desconto_itens_contrato_idx on public.caucao_desconto_itens (contrato_id);

alter table public.caucao_prazos enable row level security;
alter table public.caucao_desconto_itens enable row level security;
revoke all on public.caucao_prazos from anon, authenticated;
revoke all on public.caucao_desconto_itens from anon, authenticated;
grant select on public.caucao_prazos to authenticated;
grant select on public.caucao_desconto_itens to authenticated;
drop policy if exists "caucao_prazos: as partes leem" on public.caucao_prazos;
create policy "caucao_prazos: as partes leem" on public.caucao_prazos for select to authenticated using (public.pode_ver_contrato(contrato_id));
drop policy if exists "caucao_desconto_itens: as partes leem" on public.caucao_desconto_itens;
create policy "caucao_desconto_itens: as partes leem" on public.caucao_desconto_itens for select to authenticated using (public.pode_ver_contrato(contrato_id));
comment on table public.caucao_prazos is 'E637: prazos da caução (parecer 7 d, devolução 30 d, contestação 5 d). Só o servidor grava. Atrás da chave CAUCAO_PRAZOS_ATIVA.';
comment on table public.caucao_desconto_itens is 'E637: itens do desconto da caução, um a um, sempre com prova (fotos de entrada e saída + comprovante + valor). Desgaste natural nunca desconta.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000310', '0310_caucao_prazos_e637', array['-- conteúdo em supabase/migrations/0310_caucao_prazos_e637.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000310');
commit;
