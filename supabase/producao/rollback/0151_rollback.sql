-- Rollback da 0151: volta a checagem da 0104. Contatos já salvos como "mobilia" passam a "servicos"
-- (o cartão de origem antes desta mudança) para a checagem antiga voltar sem erro.
begin;
set local lock_timeout = '5s';
update public.parceiros_interesse set tipo = 'servicos' where tipo = 'mobilia';
alter table public.parceiros_interesse drop constraint if exists parceiros_interesse_tipo_check;
alter table public.parceiros_interesse add constraint parceiros_interesse_tipo_check
  check (tipo in ('fotografo', 'empresa', 'gestor', 'servicos', 'seguros'));
delete from supabase_migrations.schema_migrations where version = '20261017000151';
commit;
