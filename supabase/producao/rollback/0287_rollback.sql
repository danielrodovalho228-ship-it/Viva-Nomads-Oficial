-- Viva Nomads — desfaz 0287 (E445). Volta o mask_contact da 0057, tira lido_em, a contagem e a fila de ofensas.
begin;
create or replace function public.mask_contact(t text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  r text := t;
  m text;
  k constant text := '🔒 [contato protegido]';
begin
  if r is null then
    return null;
  end if;
  r := regexp_replace(r, '(https?://)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me)/\S+', k, 'gi');
  r := regexp_replace(r, '[[:alnum:]_.+-]+@[[:alnum:]_-]+\.[[:alnum:]_.-]{2,}', k, 'g');
  for m in select (regexp_matches(r, '\+?\d[[:digit:][:space:]().-]{7,}\d', 'g'))[1] loop
    if length(regexp_replace(m, '\D', '', 'g')) between 10 and 13 then
      r := replace(r, m, k);
    end if;
  end loop;
  r := regexp_replace(r, '(https?://)?(www\.)?(instagram|facebook|fb|tiktok)\.com/\S+', k, 'gi');
  r := regexp_replace(r, '(^|[^[:alnum:]_@])@[A-Za-z0-9._]{2,30}', '\1' || k, 'g');
  return r;
end;
$$;
drop function if exists public.mensagens_nao_lidas();
drop policy if exists "destinatario marca lido" on public.messages;
drop index if exists public.messages_nao_lidas;
alter table public.messages drop column if exists lido_em;
-- O padrão do Supabase antes da 0287 (sem política de update, a RLS seguia barrando a alteração).
grant update on public.messages to authenticated;
drop table if exists public.moderacao_ofensas;
delete from supabase_migrations.schema_migrations where version = '20261102000287';
commit;
