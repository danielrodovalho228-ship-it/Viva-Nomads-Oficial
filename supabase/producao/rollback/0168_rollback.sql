-- Rollback da 0168: volta à regra da 0110 (a primeira resposta congela os itens das duas partes).
begin;
create or replace function public.conferencia_itens_trava() returns trigger
language plpgsql set search_path = public as $$
declare cid uuid := coalesce(new.conferencia_id, old.conferencia_id);
begin
  if pg_trigger_depth() = 1 and exists (select 1 from public.conferencia_respostas r where r.conferencia_id = cid) then
    raise exception 'A conferência já foi respondida e não pode mais ser alterada.';
  end if;
  return coalesce(new, old);
end;
$$;

delete from supabase_migrations.schema_migrations where version = '20261018000168';
commit;
