-- 0232 — Aprovações: excluir um usuário não pode mais falhar por causa do gatilho de imutabilidade (ordem 02afa253).
--   • Defeito da 0095: aprovacoes.decidido_por tem ON DELETE SET NULL. Ao excluir o usuário em auth.users, o banco faz um
--     UPDATE (decidido_por → null) numa linha já decidida; o gatilho aprovacoes_imutavel recusava e a exclusão inteira
--     falhava (pedido de apagar conta / LGPD travado por um log interno).
--   • Correção: o gatilho aceita UM único tipo de mudança numa linha decidida — decidido_por indo de um valor para null,
--     com todas as outras colunas iguais. Qualquer outra mudança continua recusada; apagar a linha continua recusado.
-- Só substitui a função (create or replace); não remove nada e não guarda dado pessoal. Idempotente. Rollback: supabase/producao/rollback/0232_rollback.sql.

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
