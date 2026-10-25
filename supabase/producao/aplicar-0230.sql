-- Viva Nomads — aplicar 0230 (respostas rápidas e mensagens programadas — Prompt 55-E2). Idempotente. Rollback: supabase/producao/rollback/0230_rollback.sql.
begin;
set local lock_timeout = '5s';

-- ── 1. Respostas rápidas ────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.respostas_rapidas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 60),
  texto text not null check (char_length(texto) between 1 and 1000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists respostas_rapidas_owner on public.respostas_rapidas (owner_id, criado_em);

-- Teto de 20 por dono também no banco (o servidor confere antes; isto segura corrida de dois envios).
create or replace function public.respostas_rapidas_limite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('respostas_rapidas:' || new.owner_id::text));
  if (select count(*) from public.respostas_rapidas where owner_id = new.owner_id) >= 20 then
    raise exception 'limite de 20 respostas rápidas' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.respostas_rapidas_limite() from public, anon, authenticated;
drop trigger if exists respostas_rapidas_limite on public.respostas_rapidas;
create trigger respostas_rapidas_limite before insert on public.respostas_rapidas
  for each row execute function public.respostas_rapidas_limite();

alter table public.respostas_rapidas enable row level security;
drop policy if exists "respostas: dono lê" on public.respostas_rapidas;
create policy "respostas: dono lê" on public.respostas_rapidas
  for select using (owner_id = (select auth.uid()));
revoke insert, update, delete on public.respostas_rapidas from anon, authenticated;
grant select on public.respostas_rapidas to authenticated;

comment on table public.respostas_rapidas is
  '55-E2: respostas salvas do dono (até 20). Gravação só pelo servidor, com o filtro de contato (bloqueia).';

-- ── 2. Mensagens programadas ────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.mensagens_programadas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  quando text not null check (quando in ('7_dias_antes', 'entrada', 'saida')),
  texto text not null check (char_length(texto) between 1 and 1000),
  enviar_em timestamptz not null,
  enviada_em timestamptz,
  cancelada_em timestamptz,
  motivo_cancelamento text check (motivo_cancelamento is null or motivo_cancelamento in ('dono', 'contrato_encerrado', 'contato', 'vencida')),
  mensagem_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- Um modelo de cada por estadia enquanto não for cancelado (cancelado, dá para programar de novo).
create unique index if not exists mensagens_programadas_uma_por_modelo
  on public.mensagens_programadas (contrato_id, quando) where cancelada_em is null;
create index if not exists mensagens_programadas_fila
  on public.mensagens_programadas (enviar_em) where enviada_em is null and cancelada_em is null;

alter table public.mensagens_programadas enable row level security;
drop policy if exists "programadas: dono lê" on public.mensagens_programadas;
create policy "programadas: dono lê" on public.mensagens_programadas
  for select using (owner_id = (select auth.uid()));
revoke insert, update, delete on public.mensagens_programadas from anon, authenticated;
grant select on public.mensagens_programadas to authenticated;

comment on table public.mensagens_programadas is
  '55-E2: mensagens do dono programadas por estadia. Envio pelo cron (silêncio 22h–7h); aditivo reagenda, encerramento cancela.';

-- ── 3. Envio periódico ──────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.mensagens_programadas_tique() returns void
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
        url := site || '/api/cron/mensagens-programadas',
        headers := jsonb_build_object('Authorization', 'Bearer ' || segredo)
      );
    end if;
  exception when others then
    raise notice 'mensagens_programadas_tique: rota não chamada (%).', sqlerrm;
  end;
end;
$$;
revoke all on function public.mensagens_programadas_tique() from public, anon, authenticated;

do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('mensagens-programadas')
    where exists (select 1 from cron.job where jobname = 'mensagens-programadas');
  perform cron.schedule('mensagens-programadas', '7 * * * *', 'select public.mensagens_programadas_tique();');
exception when others then
  raise notice 'pg_cron indisponível (%). O cron diário da Vercel cobre o envio.', sqlerrm;
end $cron$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000230', '0230_respostas_rapidas',
       array['-- conteúdo em supabase/migrations/0230_respostas_rapidas.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000230');
commit;
