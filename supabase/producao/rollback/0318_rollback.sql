-- Rollback da 0318 (E668). Coluna aditiva e nula: desfazer = desregistrar e (se quiser) removê-la.
-- Ao remover, o papel "parceiro" gravado volta a valer como antes (sem exigir escolha).
begin;
revoke update (papel_ativo_escolhido_em) on public.profiles from authenticated;
alter table public.profiles drop column if exists papel_ativo_escolhido_em;
delete from supabase_migrations.schema_migrations where version = '20261107000318';
commit;
