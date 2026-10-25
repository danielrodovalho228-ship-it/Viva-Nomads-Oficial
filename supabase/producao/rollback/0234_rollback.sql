-- Viva Nomads — rollback da 0234: volta o gatilho da 0091 (sem exigir o tipo) e tira a coluna sublease_doc_tipo. Idempotente.
begin;
set local lock_timeout = '5s';
create or replace function public.properties_exige_autorizacao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') or public.is_admin() then
    return new;
  end if;
  if new.status::text = 'active'
     and new.ownership_type::text <> 'own'
     and (not coalesce(new.sublease_authorized, false)
          or new.sublease_doc_url is null
          or new.sublease_doc_url !~ ('^' || new.owner_id::text || '/[^/]+$'))
  then
    raise exception 'Imóvel sublocado ou administrado só é publicado com a autorização do proprietário (ou a procuração) anexada'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists properties_exige_autorizacao on public.properties;
create trigger properties_exige_autorizacao
  before insert or update of status, ownership_type, sublease_authorized, sublease_doc_url on public.properties
  for each row execute function public.properties_exige_autorizacao();
revoke all on function public.properties_exige_autorizacao() from public, anon;
alter table public.properties drop constraint if exists properties_sublease_doc_tipo_valido;
alter table public.properties drop column if exists sublease_doc_tipo;
delete from supabase_migrations.schema_migrations where version = '20261024000234';
commit;
