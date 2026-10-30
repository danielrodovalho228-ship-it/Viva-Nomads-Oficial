-- Rollback da 0265: devolve à Ana (conta de teste) a intenção que ela tinha antes ('anunciar'), só se ainda estiver
-- vazia (se a prova já gravou a intenção de novo, nada muda).
begin;
set local lock_timeout = '5s';
update public.profiles
   set intencao = array['anunciar']::text[]
 where id = '3555816b-7100-4301-94a4-aec9eeccf991'
   and email = 'inquilino2@vivanomads.com.br'
   and is_teste is true
   and intencao is null;
delete from supabase_migrations.schema_migrations where version = '20261030000265';
commit;
