-- Rollback da 0167: volta para 90 dias os laudos criados ATÉ 18/10/2026 que a 0167 estendeu para 12 meses e que
-- ainda valem (os gravados depois já nasceram com 12 meses pelo código do #838 e ficam como estão).
begin;
update public.tenant_verifications
   set valid_until = created_at + interval '90 days'
 where created_at < '2026-10-19'
   and valid_until = created_at + interval '12 months'
   and valid_until > now();
delete from supabase_migrations.schema_migrations where version = '20261018000167';
commit;
