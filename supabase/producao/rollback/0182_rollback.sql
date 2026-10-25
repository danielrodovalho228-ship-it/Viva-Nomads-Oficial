-- Rollback da 0182. A anulação de documento emitido NÃO se desfaz (o gatilho 0083 proíbe, e documento fiscal
-- nunca volta a valer): os pagamentos anulados continuam anulados, só ficam fora dos índices.
begin;
drop index if exists public.pagamentos_bloco_uma_caucao;
drop index if exists public.pagamentos_bloco_um_valor_mensal;
-- A Caução volta ao bloco em que estava (cópia guardada pela 0182).
update public.pagamentos_bloco p set bloco_id = b.bloco_id
  from public._bkp_0182_caucao_bloco b where b.id = p.id and p.bloco_id is null;
-- Cauções registradas depois da 0182 (sem bloco) vão para o 1º bloco do contrato, para o not null voltar.
update public.pagamentos_bloco p set bloco_id = (
  select b.id from public.contrato_blocos b where b.contrato_id = p.contrato_id order by b.numero_bloco limit 1)
 where p.bloco_id is null;
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_bloco_por_tipo;
alter table public.pagamentos_bloco alter column bloco_id set not null;
drop policy if exists "proprietário registra recebimento" on public.pagamentos_bloco;
create policy "proprietário registra recebimento" on public.pagamentos_bloco
  for insert with check (
    marcado_por = auth.uid()
    and coalesce(confirmado_pelo_inquilino, false) = false
    and confirmado_em is null
    and exists (
      select 1 from public.contratos c join public.properties p on p.id = c.property_id
      where c.id = pagamentos_bloco.contrato_id and p.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.contrato_blocos b
      where b.id = pagamentos_bloco.bloco_id and b.contrato_id = pagamentos_bloco.contrato_id
    )
  );
drop function if exists public.conferir_documento(text);
create function public.conferir_documento(p_codigo text)
returns table (numero text, tipo text, valor numeric, emitido_em timestamptz, periodo_inicio date, periodo_fim date, locador text, locatario text, anulado_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.numero, d.tipo, d.valor, d.criado_em, d.periodo_inicio, d.periodo_fim,
         public.iniciais(d.locador_nome), public.iniciais(d.locatario_nome), d.anulado_em
  from public.documentos_fiscais d
  where p_codigo ~ '^[0-9a-f]{32}$' and d.codigo_verificacao = p_codigo
$$;
revoke all on function public.conferir_documento(text) from public;
grant execute on function public.conferir_documento(text) to anon, authenticated, service_role;
delete from supabase_migrations.schema_migrations where version = '20261019000182';
commit;
