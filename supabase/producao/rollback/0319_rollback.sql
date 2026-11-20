-- Rollback da 0319 (E669). Restaura a imutabilidade total do laudo e remove a função de troca.
-- A tabela de registro só é removida se estiver vazia (senão perderia o histórico de laudos retirados): confira antes.
begin;
drop function if exists public.trocar_laudo_conferencia(uuid, uuid, text, integer, text);
create or replace function public.conferencia_laudos_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and pg_trigger_depth() = 1 then
    raise exception 'O laudo anexado não pode ser alterado.';
  end if;
  return coalesce(new, old);
end;
$$;
-- drop table public.conferencia_laudos_retirados;  -- só depois de arquivar o histórico
delete from supabase_migrations.schema_migrations where version = '20261107000319';
commit;
