-- 0308 — E634: ficha-resumo do contrato (aprovado pelo Daniel em 05/11/2026). Atrás da chave FICHA_RESUMO_ATIVA (desligada): a tabela
-- existe, mas nada a lê nem a grava enquanto a chave estiver desligada. Entra no ar junto com o modelo de contrato da Dra. Beatriz.
--   dia_vencimento: o dia do mês em que o aluguel vence (1..28, existe em todo mês).
--   conta de recebimento: nome do titular, instituição e SÓ O FINAL do documento e da conta/Pix (a Viva guarda a chave e o resultado,
--     não o dado bruto — desenho do E293).
--   conta de TERCEIRO: a autorização expressa é obrigatória no próprio banco (quem autorizou, quando e a versão do texto aceito).
--   RLS: as duas partes do contrato leem; ninguém escreve pela API (só o servidor, com service_role, depois de conferir que quem grava
--   é o proprietário). Idempotente. Desfazer: supabase/producao/rollback/0308_rollback.sql.
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
