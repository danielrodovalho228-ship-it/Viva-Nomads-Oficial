-- Rollback da 0180: devolve o enviado_em antigo, tira as falhas de envio da fila e as duas colunas.
begin;
update public.documentos_fiscais d set enviado_em = b.enviado_em
  from public._bkp_0180_enviado_em b where b.id = d.id and d.enviado_em is null;
delete from public.documentos_falhas where etapa = 'envio';
alter table public.documentos_falhas drop constraint if exists documentos_falhas_etapa;
alter table public.documentos_falhas drop column if exists etapa;
-- Gatilho de imutabilidade como na 0083 (sem "envio").
create or replace function public.documentos_fiscais_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - array['enviado_em', 'contrato_id', 'pagamento_id', 'acerto_id', 'owner_id', 'tenant_id', 'anulado_em', 'anulado_motivo'])
     is distinct from (to_jsonb(old) - array['enviado_em', 'contrato_id', 'pagamento_id', 'acerto_id', 'owner_id', 'tenant_id', 'anulado_em', 'anulado_motivo'])
     or (new.contrato_id is not null and new.contrato_id is distinct from old.contrato_id)
     or (new.pagamento_id is not null and new.pagamento_id is distinct from old.pagamento_id)
     or (new.acerto_id is not null and new.acerto_id is distinct from old.acerto_id)
     or (new.owner_id is not null and new.owner_id is distinct from old.owner_id)
     or (new.tenant_id is not null and new.tenant_id is distinct from old.tenant_id)
     -- anulação: só de "não anulado" para "anulado", uma vez, e não se desfaz
     or (old.anulado_em is not null and (new.anulado_em, new.anulado_motivo) is distinct from (old.anulado_em, old.anulado_motivo))
  then
    raise exception 'documento emitido não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;
alter table public.documentos_fiscais drop constraint if exists documentos_fiscais_envio_lista;
alter table public.documentos_fiscais drop column if exists envio;
drop table if exists public._bkp_0180_enviado_em;
delete from supabase_migrations.schema_migrations where version = '20261019000180';
commit;
