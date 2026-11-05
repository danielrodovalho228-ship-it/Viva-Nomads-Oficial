-- Viva Nomads — aplicar 0295 (E546: anula o REC-2026-000005, recibo em duplicidade de conta de teste). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0295_rollback.sql.
begin;
set local lock_timeout = '5s';
with alvo as (
  select d.id as doc_id, d.pagamento_id
    from public.documentos_fiscais d
    join public.profiles pr on pr.id = d.owner_id and pr.is_teste
   where d.numero = 'REC-2026-000005' and d.anulado_em is null
)
update public.pagamentos_bloco p
   set anulado_em = now(), anulado_motivo = 'registro em duplicidade'
  from alvo
 where p.id = alvo.pagamento_id and p.anulado_em is null;

update public.documentos_fiscais d
   set anulado_em = now(), anulado_motivo = 'registro em duplicidade'
  from public.profiles pr
 where d.numero = 'REC-2026-000005' and d.anulado_em is null and pr.id = d.owner_id and pr.is_teste;

update public.documentos_registro r
   set status = 'anulado', anulado_motivo = 'registro em duplicidade', status_em = now()
 where r.numero = 'REC-2026-000005' and r.status = 'valido' and r.is_teste;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000295', '0295_recibo_duplicado_e546', array['-- conteúdo em supabase/migrations/0295_recibo_duplicado_e546.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000295');
commit;
