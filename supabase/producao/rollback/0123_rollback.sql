-- Rollback da 0123: volta a função ao estado da 0121 (sem search_path fixo).
begin;
create or replace function public.pets_inquilino_limite() returns trigger language plpgsql as $f$
begin
  if (select count(*) from public.pets_inquilino where user_id = new.user_id) >= 3 then
    raise exception 'Limite de 3 pets por conta';
  end if;
  return new;
end $f$;
delete from supabase_migrations.schema_migrations where version = '20261014000123';
commit;
