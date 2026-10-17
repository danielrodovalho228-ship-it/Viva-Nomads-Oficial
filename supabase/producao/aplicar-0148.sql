-- Viva Nomads — aplicar 0148 (visita por vídeo: pedidos do morador, confirmação do proprietário). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0148_rollback.sql.
begin;
set local lock_timeout = '5s';

-- 0148 — Visita por vídeo (ordem 6f964617, telas 8 e 9).
-- O morador pede até 3 horários (próximos 7 dias); o proprietário confirma um e informa o link da chamada.
-- Leitura: o morador vê os próprios pedidos; o proprietário vê os dos SEUS imóveis; o admin vê todos.
-- tenant_id NÃO é legível pelo usuário (grant por coluna): o proprietário nunca recebe a identidade do morador
-- (contato protegido até o aceite). Toda escrita é do servidor (service role), que valida horários, dono e link.
-- Idempotente. Rollback: supabase/producao/rollback/0148_rollback.sql.
do $$
begin
  if to_regclass('public.visitas_video') is null then
    create table public.visitas_video (
      id uuid primary key default gen_random_uuid(),
      property_id uuid not null references public.properties (id) on delete cascade,
      owner_id uuid not null references auth.users (id) on delete cascade,
      tenant_id uuid not null references auth.users (id) on delete cascade,
      horarios timestamptz[] not null check (cardinality(horarios) between 1 and 3),
      motivo text check (motivo is null or char_length(motivo) <= 40),
      status text not null default 'pedido' check (status in ('pedido', 'confirmado', 'feito', 'cancelado')),
      horario_confirmado timestamptz,
      link_chamada text check (link_chamada is null or char_length(link_chamada) <= 300),
      criado_em timestamptz not null default now(),
      atualizado_em timestamptz not null default now()
    );
    create index visitas_video_owner_idx on public.visitas_video (owner_id, criado_em desc);
    create index visitas_video_tenant_idx on public.visitas_video (tenant_id, criado_em desc);
    create index visitas_video_property_idx on public.visitas_video (property_id);
    -- Um pedido em aberto por morador e imóvel.
    create unique index visitas_video_um_aberto on public.visitas_video (tenant_id, property_id)
      where status in ('pedido', 'confirmado');
  end if;
end $$;

alter table public.visitas_video enable row level security;
revoke all on public.visitas_video from anon, authenticated;
grant select (id, property_id, owner_id, horarios, motivo, status, horario_confirmado, link_chamada, criado_em, atualizado_em)
  on public.visitas_video to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'visitas_video' and policyname = 'visitas_video_ler') then
    create policy visitas_video_ler on public.visitas_video
      for select to authenticated
      using (tenant_id = (select auth.uid()) or owner_id = (select auth.uid()) or (select public.is_admin()));
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261017000148', '0148_visitas_video',
       array['-- conteúdo em supabase/migrations/0148_visitas_video.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261017000148');
commit;
