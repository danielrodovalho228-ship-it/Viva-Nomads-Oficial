-- Rollback da 0273: saem as duas visitas de teste da inquilino2 (pelos ids fixos, em qualquer status em que o QA as
-- tenha deixado) e as marcas de véspera que a massa gravou. Nada mais é tocado.
begin;
set local lock_timeout = '5s';
delete from public.automacoes_envios where chave like 'visita_vespera:a0273000-0000-4000-8000-00000000000_:%';
delete from public.visitas_video where id in ('a0273000-0000-4000-8000-000000000001', 'a0273000-0000-4000-8000-000000000002');
delete from supabase_migrations.schema_migrations where version = '20261031000273';
commit;
