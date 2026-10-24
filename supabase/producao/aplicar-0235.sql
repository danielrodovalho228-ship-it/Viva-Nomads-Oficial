-- Viva Nomads — aplicar 0235 (CAMPOS-2: detalhes opcionais do anúncio). Idempotente. Rollback: supabase/producao/rollback/0235_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.properties add column if not exists detalhes_anuncio jsonb;
do $$ begin
  alter table public.properties add constraint properties_detalhes_anuncio_objeto
    check (detalhes_anuncio is null or jsonb_typeof(detalhes_anuncio) = 'object');
exception when duplicate_object then null; end $$;
comment on column public.properties.detalhes_anuncio is
  'CAMPOS-2: incluído no preço, áreas do condomínio, andar/elevador, janela de entrada/saída, detalhe da vaga. Validado em src/lib/anuncio/detalhes-anuncio.ts. Público como o resto do anúncio.';
grant select (detalhes_anuncio) on public.properties to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261024000235', '0235_detalhes_anuncio',
       array['-- conteúdo em supabase/migrations/0235_detalhes_anuncio.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000235');
commit;
