-- Rollback da 0301 (E543): tira a prevenção (o id deixa de ser sorteado de novo na colisão). O contrato recriado como
-- VN-CT-A0268B01 e o registro anulado ficam (o registro é imutável; voltar o id recriaria o número repetido).
begin;
drop trigger if exists trg_contratos_numero_unico on public.contratos;
drop function if exists public.contratos_numero_unico();
delete from supabase_migrations.schema_migrations where version = '20261105000301';
commit;
