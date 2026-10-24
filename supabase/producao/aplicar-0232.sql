-- Viva Nomads — aplicar 0232 (aprovações: excluir usuário não falha mais no gatilho de imutabilidade). Idempotente. Rollback: supabase/producao/rollback/0232_rollback.sql.
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
    -- Único caso permitido: o ON DELETE SET NULL da FK de decidido_por (usuário excluído). Nada mais muda.
    if old.decidido_por is not null
       and new.decidido_por is null
       and (to_jsonb(new) - 'decidido_por') = (to_jsonb(old) - 'decidido_por') then
      return new;
    end if;
    raise exception 'aprovação já decidida não pode mudar';
  end if;
  return new;
end;
$fn$;

revoke all on function public.aprovacoes_imutavel() from public, anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023200232', '0232_aprovacoes_fk_decidido_por',
       array['-- conteúdo em supabase/migrations/0232_aprovacoes_fk_decidido_por.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023200232');
commit;
