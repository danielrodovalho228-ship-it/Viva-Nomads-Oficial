-- Rollback da 0331: devolve o UDI-002 a em_teste, só se foi a própria 0331 que o ativou (motivo da massa).
begin;
update public.avaliadores_credenciamento
   set status = 'em_teste', ativado_em = null, decidido_em = null, motivo = null
 where numero_credenciado = 'UDI-002'
   and status = 'ativo'
   and motivo like 'Massa de teste E690:%';
delete from supabase_migrations.schema_migrations where version = '20261107000331';
commit;
