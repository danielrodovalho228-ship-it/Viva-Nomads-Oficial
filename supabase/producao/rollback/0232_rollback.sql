-- Viva Nomads — rollback da 0232: volta o gatilho da 0095 (qualquer mudança em linha decidida é recusada). Idempotente.
begin;
set local lock_timeout = '5s';
create or replace function public.aprovacoes_imutavel()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'aprovacoes é um registro imutável';
  end if;
  if old.status <> 'pendente' then
    raise exception 'aprovação já decidida não pode mudar';
  end if;
  return new;
end;
$fn$;
revoke all on function public.aprovacoes_imutavel() from public, anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261023200232';
commit;
