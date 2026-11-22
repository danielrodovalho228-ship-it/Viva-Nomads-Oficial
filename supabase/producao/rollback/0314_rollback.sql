-- Rollback da 0314 (E647): coluna aditiva e anulável; sem a chave ligada nada a preenche.
begin;
alter table public.proposta_versoes drop constraint if exists proposta_versoes_forma_pagamento;
alter table public.proposta_versoes drop column if exists forma_pagamento;
delete from supabase_migrations.schema_migrations where version = '20261106000314';
commit;
