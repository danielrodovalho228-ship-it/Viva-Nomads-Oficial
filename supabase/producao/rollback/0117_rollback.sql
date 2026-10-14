-- Rollback da 0117: remove o laudo independente (as fotos e respostas da conferência ficam).
-- Os arquivos do bucket 'conferencia' não são apagados aqui (apague pelo painel do Supabase se quiser).
begin;
drop table if exists public.conferencia_laudos;
drop function if exists public.conferencia_laudos_imutavel();
delete from supabase_migrations.schema_migrations where version = '20261014000117';
commit;
