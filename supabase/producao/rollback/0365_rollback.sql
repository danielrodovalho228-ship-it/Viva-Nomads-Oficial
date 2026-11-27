-- Viva Nomads — desfazer a 0365 (E1208: a linha curada do perfil público ligada ao credenciamento do mesmo número).
-- Desliga as linhas ligadas ao credenciamento do MESMO número (a única ligação que existe: nada mais grava esta coluna)
-- e tira o registo. Nome, cidade, selo e publicação ficam como estão.
begin;
update public.avaliadores_perfil_publico p
   set credenciamento_id = null
  from public.avaliadores_credenciamento c
 where p.credenciamento_id = c.id
   and c.numero_credenciado = p.numero;
delete from supabase_migrations.schema_migrations where version = '20261126000365';
commit;
