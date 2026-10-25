-- Viva Nomads — rollback da 0249: remove as colunas do cartão "Por que estou na cidade". Idempotente.
begin;
set local lock_timeout = '5s';
alter table public.profiles drop constraint if exists profiles_cidade_porque_chk;
alter table public.profiles drop column if exists cidade_periodo_inicio;
alter table public.profiles drop column if exists cidade_periodo_fim;
alter table public.profiles drop column if exists cidade_empresa;
alter table public.profiles drop column if exists cidade_frase;
delete from supabase_migrations.schema_migrations where version = '20261025000249';
commit;
