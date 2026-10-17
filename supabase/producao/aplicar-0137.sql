-- Viva Nomads — aplicar 0137 (alerta de busca salva: e-mail quando um imóvel publicado combina com a busca).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0137_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'buscas_salvas' and column_name = 'alerta_ativo') then
    alter table public.buscas_salvas add column alerta_ativo boolean not null default true;
  end if;
end $$;

grant update (alerta_ativo) on public.buscas_salvas to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buscas_salvas' and policyname = 'buscas_salvas_alerta') then
    create policy buscas_salvas_alerta on public.buscas_salvas
      for update to authenticated
      using (usuario_id = (select auth.uid()))
      with check (usuario_id = (select auth.uid()));
  end if;
  if to_regclass('public.alertas_busca_envios') is null then
    create table public.alertas_busca_envios (
      busca_id uuid not null references public.buscas_salvas (id) on delete cascade,
      imovel_id uuid not null references public.properties (id) on delete cascade,
      criado_em timestamptz not null default now(),
      enviado_em timestamptz,
      primary key (busca_id, imovel_id)
    );
    create index alertas_busca_envios_pendentes_idx on public.alertas_busca_envios (busca_id) where enviado_em is null;
  end if;
end $$;

-- Só o servidor (service role) lê e grava os envios: RLS ligada, sem política e sem grant.
alter table public.alertas_busca_envios enable row level security;
revoke all on public.alertas_busca_envios from anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261016000137', '0137_alerta_busca_salva',
       array['-- conteúdo em supabase/migrations/0137_alerta_busca_salva.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000137');
commit;
