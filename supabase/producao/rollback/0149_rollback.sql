-- Rollback da 0149: remove a função e as 3 colunas novas de profiles (o que foi escrito nelas se perde).
begin;
set local lock_timeout = '5s';
drop function if exists public.perfil_publico_proprietario(uuid);
revoke update (bio, idiomas, cidade) on public.profiles from authenticated;
alter table public.profiles drop constraint if exists profiles_bio_tamanho;
alter table public.profiles drop constraint if exists profiles_idiomas_qtd;
alter table public.profiles drop constraint if exists profiles_cidade_tamanho;
alter table public.profiles drop column if exists bio;
alter table public.profiles drop column if exists idiomas;
alter table public.profiles drop column if exists cidade;
delete from supabase_migrations.schema_migrations where version = '20261017000149';
commit;
