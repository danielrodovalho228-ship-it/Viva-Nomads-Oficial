-- Viva Nomads — rollback da 0354 (E1059): o gatilho das mensagens volta a só mascarar (a definição da 0057) e a função
-- contem_documento sai. Nunca roda sozinho. Depois dele, o CPF inserido direto em `messages` volta a ficar mascarado.
begin;
set local lock_timeout = '5s';
create or replace function public.trg_mask_body()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.body := public.mask_contact(new.body);
  return new;
end;
$$;
drop function if exists public.contem_documento(text);
delete from supabase_migrations.schema_migrations where version = '20261122000354';
commit;
