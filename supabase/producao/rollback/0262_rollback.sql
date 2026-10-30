-- Rollback da 0262: sai a fila dos e-mails proativos e a categoria "sugestoes" (quem a tinha desligada perde só essa
-- marca; o código anterior lê os mesmos eventos em "outros"/"lembretes"). Rodar só junto com o revert do código.
begin;
set local lock_timeout = '5s';
drop table if exists public.emails_proativos;
update public.profiles set notif_categorias_desligadas = array_remove(notif_categorias_desligadas, 'sugestoes')
 where 'sugestoes' = any (notif_categorias_desligadas);
alter table public.profiles drop constraint if exists profiles_notif_categorias_chk;
alter table public.profiles add constraint profiles_notif_categorias_chk
  check (notif_categorias_desligadas <@ array['mensagens', 'lembretes', 'outros']::text[]);
delete from supabase_migrations.schema_migrations where version = '20261030000262';
commit;
