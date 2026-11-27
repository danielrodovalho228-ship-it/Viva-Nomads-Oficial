-- Rollback da 0333: o Plano de manutenção volta a ativo (estado da 0015).
begin;
update public.servicos_adicionais set status = 'ativo' where id = 'plano_manutencao' and status = 'em_breve';
delete from supabase_migrations.schema_migrations where version = '20261107000333';
commit;
