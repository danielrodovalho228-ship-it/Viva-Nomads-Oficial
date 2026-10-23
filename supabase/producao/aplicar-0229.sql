-- Viva Nomads — aplicar 0229 (importar calendário do Airbnb/Booking — Prompt 53). Idempotente. Rollback: supabase/producao/rollback/0229_rollback.sql.
begin;
set local lock_timeout = '5s';

-- ── 1. Importações ──────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.calendario_importacoes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  url text not null check (char_length(url) between 12 and 2048 and url like 'https://%'),
  dominio text not null check (char_length(dominio) between 3 and 255),
  origem text not null default 'outro' check (origem in ('airbnb', 'booking', 'vrbo', 'outro')),
  ativo boolean not null default true,
  ultima_leitura timestamptz,
  ultimo_erro text check (ultimo_erro is null or char_length(ultimo_erro) <= 300),
  falhas_seguidas integer not null default 0 check (falhas_seguidas >= 0),
  criado_em timestamptz not null default now(),
  unique (property_id, url)
);
create index if not exists calendario_importacoes_leitura on public.calendario_importacoes (ativo, ultima_leitura);
comment on table public.calendario_importacoes is
  'Prompt 53: links .ics do Airbnb/Booking por imóvel (até 3). Só o servidor lê o link; a tela mostra o domínio.';
alter table public.calendario_importacoes enable row level security;
revoke all on public.calendario_importacoes from anon, authenticated;
grant all on public.calendario_importacoes to service_role;

-- ── 2. Origem do bloqueio ───────────────────────────────────────────────────────────────────────────────────────
alter table public.property_blocks add column if not exists origem text not null default 'manual';
alter table public.property_blocks add column if not exists importacao_id uuid references public.calendario_importacoes(id) on delete cascade;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'property_blocks_origem_chk') then
    alter table public.property_blocks add constraint property_blocks_origem_chk
      check ((origem = 'manual' and importacao_id is null) or (origem = 'importado' and importacao_id is not null));
  end if;
end $$;
create index if not exists property_blocks_importacao on public.property_blocks (importacao_id) where importacao_id is not null;
comment on column public.property_blocks.origem is 'Prompt 53: manual (o dono bloqueou) ou importado (calendário de outro site).';

-- O dono continua gerenciando só os bloqueios MANUAIS pela sessão; os importados são do servidor (a sincronia).
drop policy if exists "blocks: dono gerencia" on public.property_blocks;
create policy "blocks: dono gerencia" on public.property_blocks
  for all
  using (
    origem = 'manual'
    and exists (select 1 from public.properties p where p.id = property_blocks.property_id and p.owner_id = auth.uid())
  )
  with check (
    origem = 'manual'
    and exists (select 1 from public.properties p where p.id = property_blocks.property_id and p.owner_id = auth.uid())
  );

-- ── 3. Leitura periódica ────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.calendario_importar_tique() returns void
language plpgsql security definer set search_path = public as $$
declare
  segredo text;
  site text;
begin
  begin
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'cron_secret';
    select decrypted_secret into site from vault.decrypted_secrets where name = 'site_url';
    if segredo is not null and site is not null and to_regproc('net.http_get') is not null then
      perform net.http_get(
        url := site || '/api/cron/calendario',
        headers := jsonb_build_object('Authorization', 'Bearer ' || segredo)
      );
    end if;
  exception when others then
    raise notice 'calendario_importar_tique: rota não chamada (%).', sqlerrm;
  end;
end;
$$;
revoke all on function public.calendario_importar_tique() from public, anon, authenticated;

do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('calendario-importar')
    where exists (select 1 from cron.job where jobname = 'calendario-importar');
  perform cron.schedule('calendario-importar', '23 * * * *', 'select public.calendario_importar_tique();');
exception when others then
  raise notice 'pg_cron indisponível (%). O cron diário da Vercel cobre a leitura.', sqlerrm;
end $cron$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000229', '0229_importar_calendario',
       array['-- conteúdo em supabase/migrations/0229_importar_calendario.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000229');
commit;
