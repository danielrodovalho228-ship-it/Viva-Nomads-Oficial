-- Rollback da 0295 (E546): o pagamento e o documento fiscal do REC-2026-000005 voltam a contar. O registro único
-- (documentos_registro, 0201) é imutável por desenho — o status só anda uma vez (valido → anulado) —, então a linha do
-- registro fica "anulado"; para reativar o número, a equipe emite um documento novo.
begin;
set local lock_timeout = '5s';
update public.pagamentos_bloco p set anulado_em = null, anulado_motivo = null
  from public.documentos_fiscais d
 where d.numero = 'REC-2026-000005' and p.id = d.pagamento_id and p.anulado_motivo = 'registro em duplicidade';
update public.documentos_fiscais set anulado_em = null, anulado_motivo = null
 where numero = 'REC-2026-000005' and anulado_motivo = 'registro em duplicidade';
delete from supabase_migrations.schema_migrations where version = '20261105000295';
commit;
