-- Viva Nomads — aplicar 0234 (tipo do documento do imóvel administrado: contrato de gestão ou procuração). Idempotente. Rollback: supabase/producao/rollback/0234_rollback.sql.
begin;
set local lock_timeout = '5s';
alter table public.properties add column if not exists sublease_doc_tipo text;

do $$ begin
  alter table public.properties add constraint properties_sublease_doc_tipo_valido
    check (sublease_doc_tipo is null or sublease_doc_tipo in ('autorizacao', 'contrato_gestao', 'procuracao'));
exception when duplicate_object then null; end $$;

comment on column public.properties.sublease_doc_tipo is
  'Tipo do documento da operação anexado em sublease_doc_url. Administrado (managed) exige contrato_gestao ou procuracao para publicar.';

-- Só o dono (e o admin, pelo service role) lê o tipo; anon não precisa.
grant select (sublease_doc_tipo) on public.properties to authenticated;

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
  if new.status::text = 'active'
     and new.ownership_type::text = 'managed'
     and coalesce(new.sublease_doc_tipo, '') not in ('contrato_gestao', 'procuracao')
  then
    raise exception 'Imóvel administrado só é publicado com o tipo do documento informado (contrato de administração ou procuração)'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- O gatilho também dispara quando o tipo muda.
drop trigger if exists properties_exige_autorizacao on public.properties;
create trigger properties_exige_autorizacao
  before insert or update of status, ownership_type, sublease_authorized, sublease_doc_url, sublease_doc_tipo on public.properties
  for each row execute function public.properties_exige_autorizacao();

revoke all on function public.properties_exige_autorizacao() from public, anon;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261024000234', '0234_tipo_documento_operacao',
       array['-- conteúdo em supabase/migrations/0234_tipo_documento_operacao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000234');
commit;
