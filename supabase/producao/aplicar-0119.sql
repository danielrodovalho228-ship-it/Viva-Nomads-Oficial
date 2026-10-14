-- Viva Nomads — aplicar 0119 (regras de pets do proprietário, ordem 022afabb item 2).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0119_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.properties add column if not exists pets_regras jsonb;
comment on column public.properties.pets_regras is 'Regras de pets: {especies[], porteMax, qtdMax, reforcoCaucao, regrasCondominio}. Validado em src/lib/anuncio/pets-regras.ts.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000119', '0119_pets_regras',
       array['-- conteúdo em supabase/migrations/0119_pets_regras.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000119');
commit;
