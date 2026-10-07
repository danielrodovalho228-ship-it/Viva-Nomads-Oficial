-- Rollback da 0083. Volta grants e funções ao estado da 0082.
-- As colunas anulado_em/anulado_motivo FICAM (apagar perderia anulações já feitas);
-- só a trava de anulação única sai junto com a função nova.
begin;
-- 1) #29/#25
grant execute on function public.pedidos_publicos_lista() to anon;
grant select on public.pedidos_publicos to anon;

-- 2) #14
drop trigger if exists documentos_fiscais_sem_delete on public.documentos_fiscais;
drop trigger if exists documentos_fiscais_sem_truncate on public.documentos_fiscais;
drop function if exists public.documentos_fiscais_sem_delete();
grant delete, truncate on public.documentos_fiscais to service_role;
create or replace function public.documentos_fiscais_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - array['enviado_em', 'contrato_id', 'pagamento_id', 'acerto_id', 'owner_id', 'tenant_id'])
     is distinct from (to_jsonb(old) - array['enviado_em', 'contrato_id', 'pagamento_id', 'acerto_id', 'owner_id', 'tenant_id'])
     or (new.contrato_id is not null and new.contrato_id is distinct from old.contrato_id)
     or (new.pagamento_id is not null and new.pagamento_id is distinct from old.pagamento_id)
     or (new.acerto_id is not null and new.acerto_id is distinct from old.acerto_id)
     or (new.owner_id is not null and new.owner_id is distinct from old.owner_id)
     or (new.tenant_id is not null and new.tenant_id is distinct from old.tenant_id)
  then
    raise exception 'documento emitido não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop function if exists public.conferir_documento(text);
create function public.conferir_documento(p_codigo text)
returns table (numero text, tipo text, valor numeric, emitido_em timestamptz, periodo_inicio date, periodo_fim date, locador text, locatario text)
language sql
stable
security definer
set search_path = public
as $$
  select d.numero, d.tipo, d.valor, d.criado_em, d.periodo_inicio, d.periodo_fim,
         public.iniciais(d.locador_nome), public.iniciais(d.locatario_nome)
  from public.documentos_fiscais d
  where p_codigo ~ '^[0-9a-f]{32}$' and d.codigo_verificacao = p_codigo
$$;
revoke all on function public.conferir_documento(text) from public;
grant execute on function public.conferir_documento(text) to anon, authenticated, service_role;

-- 3) #32 — devolve INSERT/UPDATE/DELETE nas 43 (algumas não tinham UPDATE ou DELETE antes; o RLS segue barrando).
grant insert, update, delete on table
  public.account_type_audit, public.ai_generations, public.contracts, public.contrato_blocos,
  public.contratos, public.document_counters, public.document_line_items, public.documents,
  public.favorites, public.garantias, public.guarantees, public.insurance_quotes,
  public.invoices, public.leads, public.locacoes, public.messages,
  public.modelos_contrato, public.moderacao_log, public.pagamentos_bloco, public.payment_accounts,
  public.pedidos_moradia, public.properties, public.property_amenities, public.property_blocks,
  public.property_photos, public.property_proximities, public.property_workspaces, public.push_tokens,
  public.qualification_checklists, public.referral_credits, public.referrals, public.respostas_pedido,
  public.reviews, public.service_order_messages, public.service_orders, public.servicos_adicionais,
  public.subscriptions, public.tenant_verifications, public.transactions, public.utility_extra_charges,
  public.vistoria_fotos, public.vistoria_itens, public.vistorias
to anon;
alter default privileges for role postgres in schema public grant insert, update, delete on tables to anon;

delete from supabase_migrations.schema_migrations where version = '20261007000083';
commit;
