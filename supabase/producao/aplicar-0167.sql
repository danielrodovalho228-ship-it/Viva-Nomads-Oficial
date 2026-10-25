-- Viva Nomads — aplicar 0167 (identidade: laudos já gravados passam a valer 12 meses). Idempotente: rodar de novo
-- não muda nada (a condição valid_until < created_at + 12 meses deixa de valer depois da 1ª vez).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0167_rollback.sql.
begin;
set local lock_timeout = '5s';

update public.tenant_verifications
   set valid_until = created_at + interval '12 months'
 where valid_until is not null
   and valid_until < created_at + interval '12 months'
   and valid_until > now();

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000167', '0167_caf_validade_12_meses',
       array['-- conteúdo em supabase/migrations/0167_caf_validade_12_meses.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000167');
commit;
