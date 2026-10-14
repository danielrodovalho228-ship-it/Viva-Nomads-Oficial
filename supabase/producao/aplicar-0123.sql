-- Viva Nomads — aplicar 0123 (endurece a função pets_inquilino_limite com search_path fixo).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0123_rollback.sql.
begin;
set local lock_timeout = '5s';

create or replace function public.pets_inquilino_limite() returns trigger language plpgsql
set search_path = public as $f$
begin
  if (select count(*) from public.pets_inquilino where user_id = new.user_id) >= 3 then
    raise exception 'Limite de 3 pets por conta';
  end if;
  return new;
end $f$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000123', '0123_pets_limite_search_path',
       array['-- conteúdo em supabase/migrations/0123_pets_limite_search_path.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000123');
commit;
