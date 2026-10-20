-- Rollback da 0183: a página volta a ler admin_financeiro (0071), que continua no banco sem mudança.
begin;
drop function if exists public.admin_financeiro_recorte(date, date, text, text);
drop function if exists public.admin_assinaturas_em_recorte(timestamptz, text);
drop function if exists public.admin_lead_teste(uuid);
drop function if exists public.admin_no_recorte(boolean, text);
delete from supabase_migrations.schema_migrations where version = '20261019000183';
commit;
