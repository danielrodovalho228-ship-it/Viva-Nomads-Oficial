-- 0091 — QUEM OPERA O IMÓVEL: autorização obrigatória. PRECISA APROVAÇÃO DO DANIEL — não aplicado.
-- Pacote "Cadastro confiável", parte B (08/10/2026).
--   • ownership_type ganha 'managed' ("Administro para o proprietário": gestor/procurador);
--   • sublocado ou administrado só fica ATIVO com a declaração marcada E o documento
--     (autorização escrita / contrato de administração / procuração) anexado na pasta
--     do próprio dono no bucket privado — antes era só uma caixinha;
--   • properties.autorizacao_anexada (calculada, sem o caminho do arquivo) para a tela e
--     a prontidão saberem que o documento existe sem expor sublease_doc_url.
-- Em 08/10/2026 produção tem 0 imóveis ativos (nada a corrigir). Sem DROP, sem NOTICE.

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
