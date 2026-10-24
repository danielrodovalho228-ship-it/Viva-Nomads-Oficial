-- 0234 — Ordem ab50d8af (P3, #50): imóvel administrado (managed) só é publicado com o TIPO do documento
-- (contrato de administração ou procuração). A fonte do "documento anexado" continua uma só:
-- properties.sublease_doc_url (autorizacao_anexada é calculada dela, 0091).
--   • properties.sublease_doc_tipo: 'autorizacao' | 'contrato_gestao' | 'procuracao' (nulo = não informado);
--   • o gatilho properties_exige_autorizacao passa a recusar publicar 'managed' sem tipo de gestão;
--   • sublocação continua exigindo só a declaração e o arquivo (sem tipo).
-- Em 24/10/2026 produção tem 0 imóveis managed (nada a corrigir). Sem DROP de dado; sem dados pessoais.

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
