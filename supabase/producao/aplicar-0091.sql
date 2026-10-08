-- Viva Nomads — aplicar 0091 (quem opera o imóvel: autorização obrigatória). PRECISA APROVAÇÃO DO DANIEL.
-- Rollback: supabase/producao/rollback/0091_rollback.sql
-- Só acrescenta (valor 'managed', coluna calculada, gatilho). Sem DROP, sem NOTICE.
-- Pode rodar pelo conector. Antes: em 08/10/2026 produção tem 0 imóveis ativos.
begin;
set local lock_timeout = '5s';
do $$
begin
  if not exists (select 1 from pg_enum where enumtypid = 'public.ownership_type'::regtype and enumlabel = 'managed') then
    alter type public.ownership_type add value 'managed';
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'properties' and column_name = 'autorizacao_anexada') then
    alter table public.properties
      add column autorizacao_anexada boolean generated always as (sublease_doc_url is not null) stored;
  end if;
end;
$$;

grant select (autorizacao_anexada) on public.properties to anon, authenticated;

-- SECURITY INVOKER: current_user é quem grava (service_role/admin passam; dono não).
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

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'properties_exige_autorizacao' and tgrelid = 'public.properties'::regclass) then
    create trigger properties_exige_autorizacao
      before insert or update of status, ownership_type, sublease_authorized, sublease_doc_url on public.properties
      for each row execute function public.properties_exige_autorizacao();
  end if;
end;
$$;

revoke all on function public.properties_exige_autorizacao() from public, anon;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261008000091', '0091_autorizacao_operacao',
       array['-- conteúdo em supabase/migrations/0091_autorizacao_operacao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261008000091');
commit;

-- Conferência (só leitura):
-- select enumlabel from pg_enum where enumtypid = 'public.ownership_type'::regtype order by enumsortorder;
-- select has_column_privilege('anon', 'public.properties', 'autorizacao_anexada', 'SELECT') as anon_le_flag,
--        has_column_privilege('anon', 'public.properties', 'sublease_doc_url', 'SELECT') as anon_le_caminho;  -- true, false
-- select tgname from pg_trigger where tgname = 'properties_exige_autorizacao';
