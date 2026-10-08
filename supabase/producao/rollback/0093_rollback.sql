-- Rollback da 0093: só se ainda NÃO houver documento de inquilino enviado (para não perder
-- arquivos de clientes). O bucket inquilino-docs FICA (o Supabase não deixa apagar bucket
-- por SQL); se quiser removê-lo, use o painel Storage. Rodar no SQL Editor (tem DROP).
begin;
set local lock_timeout = '5s';
do $$
begin
  if exists (select 1 from public.documentos_inquilino) then
    raise exception 'documentos_inquilino tem linhas: rollback interrompido para não perder documentos de clientes';
  end if;
end;
$$;
drop table public.documentos_inquilino;
delete from supabase_migrations.schema_migrations where version = '20261008000093';
commit;
