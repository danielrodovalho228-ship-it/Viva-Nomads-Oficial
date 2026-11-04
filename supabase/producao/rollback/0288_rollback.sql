-- Viva Nomads — desfaz 0288 (E445 item 5). Tira a tabela de anexos e o registro da migração.
-- O bucket "mensagens-anexos" fica (o storage não deixa apagar bucket com arquivos por SQL); sem a tabela e sem
-- política, nada nele é alcançável pelo navegador.
begin;
drop table if exists public.mensagens_anexos;
delete from supabase_migrations.schema_migrations where version = '20261104000288';
commit;
