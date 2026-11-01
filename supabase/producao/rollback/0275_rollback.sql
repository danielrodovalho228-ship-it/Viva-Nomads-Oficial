-- Rollback da 0275 (E375-B): tira os dois gatilhos e as funções, a tabela quedas_preco, a coluna publicado_em e o
-- evento 'resumo_semanal' da fila dos proativos (as linhas desse evento saem antes: o check antigo não as aceita).
-- Nada mais é tocado.
begin;
set local lock_timeout = '5s';
drop trigger if exists properties_registrar_queda on public.properties;
drop trigger if exists properties_marcar_publicacao on public.properties;
drop function if exists public.properties_registrar_queda();
drop function if exists public.properties_marcar_publicacao();
drop function if exists public.total_mes_do_imovel(numeric, numeric, text, numeric);
drop table if exists public.quedas_preco;
drop index if exists public.properties_publicado_em;
alter table public.properties drop column if exists publicado_em;
delete from public.emails_proativos where evento = 'resumo_semanal';
alter table public.emails_proativos drop constraint if exists emails_proativos_evento_check;
alter table public.emails_proativos add constraint emails_proativos_evento_check
  check (evento in ('pedido_imovel_novo', 'saved_search_match', 'pedido_compativel', 'pedido_expirando'));
delete from supabase_migrations.schema_migrations where version = '20261101000275';
commit;
