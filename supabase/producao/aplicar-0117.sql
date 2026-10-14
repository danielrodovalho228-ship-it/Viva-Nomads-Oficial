-- Viva Nomads — aplicar 0117 (laudo independente na conferência, ordem d3c60126).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0117_rollback.sql.
begin;
set local lock_timeout = '5s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('conferencia', 'conferencia', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if to_regclass('public.conferencia_laudos') is null then
    create table public.conferencia_laudos (
      conferencia_id uuid primary key references public.conferencias (id) on delete cascade,
      path text not null check (path ~ '^[0-9a-zA-Z-]+/[0-9a-zA-Z._-]+\.pdf$'),
      tamanho integer not null check (tamanho > 0 and tamanho <= 15728640),
      enviado_por uuid references auth.users (id) on delete set null,
      parte text not null check (parte in ('proprietario', 'inquilino')),
      criado_em timestamptz not null default now()
    );
  end if;
end;
$$;

comment on table public.conferencia_laudos is 'Laudo independente (PDF) da conferência; prevalece sobre as fotos. Só o servidor grava; imutável.';

create or replace function public.conferencia_laudos_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and pg_trigger_depth() = 1 then
    raise exception 'O laudo anexado não pode ser alterado.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace trigger conferencia_laudos_imutavel before update or delete on public.conferencia_laudos
  for each row execute function public.conferencia_laudos_imutavel();

alter table public.conferencia_laudos enable row level security;
revoke all on public.conferencia_laudos from anon, authenticated;
grant select on public.conferencia_laudos to authenticated;
grant all on public.conferencia_laudos to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conferencia_laudos' and policyname = 'conferencia laudos: partes e equipe') then
    create policy "conferencia laudos: partes e equipe" on public.conferencia_laudos for select to authenticated using (
      exists (select 1 from public.conferencias f where f.id = conferencia_laudos.conferencia_id)
    );
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000117', '0117_conferencia_laudo',
       array['-- conteúdo em supabase/migrations/0117_conferencia_laudo.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000117');
commit;
