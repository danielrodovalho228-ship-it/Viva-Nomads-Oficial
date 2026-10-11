-- Rollback da 0105: remove as duas colunas de aviso (volta a valer o envio a todos os admins se o código antigo voltar).
begin;
alter table public.profiles drop column if exists recebe_avisos_ceo;
alter table public.profiles drop column if exists recebe_alertas_operacionais;
delete from supabase_migrations.schema_migrations where version = '20261011000105';
commit;
