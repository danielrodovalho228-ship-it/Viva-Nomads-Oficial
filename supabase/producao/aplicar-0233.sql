-- Viva Nomads — aplicar 0233 (regras da casa estruturadas no anúncio). Idempotente. Rollback: supabase/producao/rollback/0233_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.properties add column if not exists regras_casa jsonb;
do $$ begin
  alter table public.properties add constraint properties_regras_casa_objeto
    check (regras_casa is null or jsonb_typeof(regras_casa) = 'object');
exception when duplicate_object then null; end $$;
comment on column public.properties.regras_casa is
  'Regras da casa estruturadas (silêncio, fumo, festas, visitas). Validado em src/lib/anuncio/regras-casa.ts. Público como o resto do anúncio.';
grant select (regras_casa) on public.properties to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000233', '0233_regras_casa',
       array['-- conteúdo em supabase/migrations/0233_regras_casa.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000233');
commit;
