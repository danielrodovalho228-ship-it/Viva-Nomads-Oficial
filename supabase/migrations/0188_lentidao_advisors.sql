-- 0188 — Lentidão (ordem 0f66a754, item 3): zera os avisos de performance que o Supabase ainda aponta.
--  a) auth_rls_initplan: 3 políticas passam a chamar (select auth.uid()), que roda uma vez por consulta.
--     Mesmo significado, mesma segurança. A política "mensagens das partes" (messages) FICA DE FORA de propósito:
--     a 0146 mostrou que embrulhar ali gera recursão de política.
--  b) unindexed_foreign_keys: 4 índices nas chaves estrangeiras sem índice. Só desempenho; nenhum dado muda.
-- Idempotente (alter policy / create index if not exists). Rollback: supabase/producao/rollback/0188_rollback.sql.
alter policy "faixa_dono_leitura" on public.faixa_dono
  using (owner_id = (select auth.uid()) or is_admin());

alter policy "dono gerencia seus ignorados" on public.pedidos_ignorados
  using (proprietario_id = (select auth.uid()) or is_admin())
  with check (proprietario_id = (select auth.uid()));

alter policy "proprietário registra recebimento" on public.pagamentos_bloco
  with check (
    marcado_por = (select auth.uid())
    and coalesce(confirmado_pelo_inquilino, false) = false
    and confirmado_em is null
    and anulado_em is null
    and exists (
      select 1 from public.contratos c
        join public.properties p on p.id = c.property_id
       where c.id = pagamentos_bloco.contrato_id and p.owner_id = (select auth.uid())
    )
    and (
      (tipo = 'caucao' and bloco_id is null)
      or (tipo = 'aluguel' and exists (
        select 1 from public.contrato_blocos b
         where b.id = pagamentos_bloco.bloco_id and b.contrato_id = pagamentos_bloco.contrato_id
      ))
    )
  );

create index if not exists idx_documentos_falhas_documento_id on public.documentos_falhas (documento_id);
create index if not exists idx_pedidos_ignorados_proprietario_id on public.pedidos_ignorados (proprietario_id);
create index if not exists idx_servicos_pedidos_property_id on public.servicos_pedidos (property_id);
create index if not exists idx_servicos_pedidos_servico_id on public.servicos_pedidos (servico_id);
