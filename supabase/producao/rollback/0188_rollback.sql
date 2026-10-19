-- Rollback da 0188: devolve as 3 políticas à forma anterior (auth.uid() direto) e remove os 4 índices.
begin;
alter policy "faixa_dono_leitura" on public.faixa_dono
  using (owner_id = auth.uid() or is_admin());

alter policy "dono gerencia seus ignorados" on public.pedidos_ignorados
  using (proprietario_id = auth.uid() or is_admin())
  with check (proprietario_id = auth.uid());

alter policy "proprietário registra recebimento" on public.pagamentos_bloco
  with check (
    marcado_por = auth.uid()
    and coalesce(confirmado_pelo_inquilino, false) = false
    and confirmado_em is null
    and anulado_em is null
    and exists (
      select 1 from public.contratos c
        join public.properties p on p.id = c.property_id
       where c.id = pagamentos_bloco.contrato_id and p.owner_id = auth.uid()
    )
    and (
      (tipo = 'caucao' and bloco_id is null)
      or (tipo = 'aluguel' and exists (
        select 1 from public.contrato_blocos b
         where b.id = pagamentos_bloco.bloco_id and b.contrato_id = pagamentos_bloco.contrato_id
      ))
    )
  );

drop index if exists public.idx_documentos_falhas_documento_id;
drop index if exists public.idx_pedidos_ignorados_proprietario_id;
drop index if exists public.idx_servicos_pedidos_property_id;
drop index if exists public.idx_servicos_pedidos_servico_id;
delete from supabase_migrations.schema_migrations where version = '20261019000188';
commit;
