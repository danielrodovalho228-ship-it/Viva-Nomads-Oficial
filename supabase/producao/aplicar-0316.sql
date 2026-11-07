-- Viva Nomads — aplicar 0316 (E660: ficha "o que tem dentro"). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0316_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.properties add column if not exists ficha_dentro jsonb;
alter table public.contratos add column if not exists ficha_dentro_congelada jsonb;

comment on column public.properties.ficha_dentro is 'E660: ficha do que tem dentro (quartos/camas/ar, enxoval, cozinha, utensílios opcionais). null = anúncio anterior à ficha.';
comment on column public.contratos.ficha_dentro_congelada is 'E660: ficha congelada na 1ª assinatura ({ficha, congeladaEm}); é o que se confere na entrada.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000316', '0316_ficha_dentro_e660', array['-- conteúdo em supabase/migrations/0316_ficha_dentro_e660.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000316');

commit;
