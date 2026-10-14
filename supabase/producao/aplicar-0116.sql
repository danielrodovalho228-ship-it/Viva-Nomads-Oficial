-- Viva Nomads — aplicar 0116 (privacidade e acesso do imóvel, ordem f92bc582).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0116_rollback.sql.
begin;
set local lock_timeout = '5s';
alter table public.properties
  add column if not exists sem_cameras_interior boolean not null default false,
  add column if not exists cameras_externas text,
  add column if not exists tipo_acesso text,
  add column if not exists senha_trocada_estadia boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_tipo_acesso_check') then
    alter table public.properties add constraint properties_tipo_acesso_check
      check (tipo_acesso is null or tipo_acesso in ('chave','fechadura_senha','cofre'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_cameras_externas_len') then
    alter table public.properties add constraint properties_cameras_externas_len
      check (cameras_externas is null or char_length(cameras_externas) <= 200);
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000116', '0116_privacidade_acesso_imovel',
       array['-- conteúdo em supabase/migrations/0116_privacidade_acesso_imovel.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000116');
commit;
