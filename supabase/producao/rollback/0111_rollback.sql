-- Rollback da 0111: apaga os registros de assinatura eletrônica (as colunas assinado_*_em do contrato ficam).
begin;
drop table if exists public.contrato_assinaturas;
delete from supabase_migrations.schema_migrations where version = '20261013000111';
commit;
