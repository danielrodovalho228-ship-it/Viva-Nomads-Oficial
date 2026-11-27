-- Viva Nomads — aplicar 0308 (E634: ficha-resumo do contrato). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0308_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E634: tabela nova, atrás da chave FICHA_RESUMO_ATIVA (desligada). Nada a lê nem a grava até a chave ligar (com o modelo de contrato
-- da Dra. Beatriz). Não altera contrato, perfil, anúncio nem chave existente. Conteúdo completo em supabase/migrations/0308_*.sql.
create table if not exists public.contrato_ficha_resumo (
  contrato_id uuid primary key references public.contratos (id) on delete cascade,
  dia_vencimento smallint check (dia_vencimento is null or dia_vencimento between 1 and 28),
  conta_titular_nome text check (conta_titular_nome is null or char_length(conta_titular_nome) between 3 and 120),
  conta_titular_documento_final text check (conta_titular_documento_final is null or conta_titular_documento_final ~ '^[0-9]{4}$'),
  conta_instituicao text check (conta_instituicao is null or char_length(conta_instituicao) between 2 and 80),
  conta_referencia_final text check (conta_referencia_final is null or char_length(conta_referencia_final) between 1 and 4),
  conta_titular_proprio boolean,
  autorizacao_terceiro_em timestamptz,
  autorizacao_terceiro_por uuid references public.profiles (id) on delete set null,
  autorizacao_texto_versao text,
  atualizado_em timestamptz not null default now(),
  constraint contrato_ficha_resumo_terceiro_autorizado check (
    conta_titular_proprio is not false
    or (autorizacao_terceiro_em is not null and autorizacao_terceiro_por is not null and autorizacao_texto_versao is not null)
  )
);

alter table public.contrato_ficha_resumo enable row level security;
revoke all on public.contrato_ficha_resumo from anon, authenticated;
grant select on public.contrato_ficha_resumo to authenticated;
drop policy if exists "contrato_ficha_resumo: as partes do contrato leem" on public.contrato_ficha_resumo;
create policy "contrato_ficha_resumo: as partes do contrato leem" on public.contrato_ficha_resumo
  for select to authenticated using (
    exists (
      select 1
        from public.contratos c
        join public.properties p on p.id = c.property_id
       where c.id = contrato_ficha_resumo.contrato_id
         and (c.tenant_id = auth.uid() or p.owner_id = auth.uid())
    )
    or public.is_admin()
  );
comment on table public.contrato_ficha_resumo is 'E634: dia de vencimento e conta de recebimento do contrato (só finais) com a autorização expressa de conta de terceiro. Só o servidor grava. Atrás da chave FICHA_RESUMO_ATIVA.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000308', '0308_contrato_ficha_resumo_e634', array['-- conteúdo em supabase/migrations/0308_contrato_ficha_resumo_e634.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000308');
commit;
