-- 0093 — DOCUMENTOS DO INQUILINO depois do aceite. APLICADA PELO MERGE (revisão do Moacir, merge do Daniel).
-- Pacote "Cadastro confiável", parte B2 (08/10/2026).
--   • bucket PRIVADO inquilino-docs (PDF/JPG/PNG, até 10 MB) SEM política para
--     anon/authenticated: o arquivo só entra e sai pelo servidor (service role), que
--     confere a candidatura aceita e devolve link assinado de 10 min a quem pode ver
--     (o inquilino, o dono da candidatura e o admin). Agentes não abrem documentos.
--   • public.documentos_inquilino: um documento por tipo (identidade, renda, vínculo)
--     por candidatura. A pessoa logada lê só tipo e data — o caminho do arquivo e o
--     hash ficam fora do grant. Escrita só pelo servidor.
-- Só cria coisas novas. Sem DROP, sem NOTICE.

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
