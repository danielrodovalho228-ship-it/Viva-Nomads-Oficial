-- Viva Nomads — aplicar 0093 (documentos do inquilino depois do aceite).
-- Aplicada pela Action "Aplicar migrações em produção" quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0093_rollback.sql. Só cria coisas novas. Sem DROP, sem NOTICE.
begin;
set local lock_timeout = '5s';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inquilino-docs', 'inquilino-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

do $$
begin
  if to_regclass('public.documentos_inquilino') is null then
    create table public.documentos_inquilino (
      id uuid primary key default gen_random_uuid(),
      lead_id uuid not null references public.leads(id) on delete cascade,
      tenant_id uuid not null references public.profiles(id) on delete cascade,
      tipo text not null check (tipo in ('identidade', 'renda', 'vinculo')),
      caminho text not null check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'),
      hash_sha256 text not null check (hash_sha256 ~ '^[0-9a-f]{64}$'),
      enviado_em timestamptz not null default now(),
      unique (lead_id, tipo)
    );
  end if;
end;
$$;

alter table public.documentos_inquilino enable row level security;
revoke all on public.documentos_inquilino from public, anon, authenticated;
grant select (id, lead_id, tenant_id, tipo, enviado_em) on public.documentos_inquilino to authenticated;
grant all on public.documentos_inquilino to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'documentos_inquilino' and policyname = 'documentos_inquilino: partes leem') then
    create policy "documentos_inquilino: partes leem" on public.documentos_inquilino
      for select to authenticated
      using (
        tenant_id = auth.uid()
        or exists (select 1 from public.leads l where l.id = documentos_inquilino.lead_id and l.owner_id = auth.uid())
        or public.is_admin()
      );
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261008000093', '0093_documentos_inquilino',
       array['-- conteúdo em supabase/migrations/0093_documentos_inquilino.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261008000093');
commit;
