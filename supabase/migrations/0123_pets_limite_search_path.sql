-- Ordem b884dfc9 (sugestão do Moacir no #480): fixa o search_path da função do gatilho
-- do limite de 3 pets por conta. Endurecimento; o comportamento não muda.
create or replace function public.pets_inquilino_limite() returns trigger language plpgsql
set search_path = public as $f$
begin
  if (select count(*) from public.pets_inquilino where user_id = new.user_id) >= 3 then
    raise exception 'Limite de 3 pets por conta';
  end if;
  return new;
end $f$;
