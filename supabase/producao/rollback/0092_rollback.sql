-- Rollback da 0092: apaga a memória dos agentes e a persona. Rodar no SQL Editor (tem DROP).
begin;
set local lock_timeout = '5s';
drop table if exists public.agentes_memoria;
alter table public.agentes drop constraint if exists agentes_persona_tamanho;
alter table public.agentes drop column if exists persona;
delete from supabase_migrations.schema_migrations where version = '20261008000092';
commit;
