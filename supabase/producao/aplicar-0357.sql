-- Viva Nomads — aplicar 0357 (E1112). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- E1112 (ORDEM-DUET-498 §2): o gatilho da 0057 (bloqueia_contato_texto, rigoroso) no nome, na descrição e na
-- descrição curta da página pública do parceiro. Nenhuma função nova; nenhum dado muda.
-- Rollback: supabase/producao/rollback/0357_rollback.sql
begin;
set local lock_timeout = '5s';

drop trigger if exists contato_parceiro_nome_publico on public.parceiros;
create trigger contato_parceiro_nome_publico before update of nome_publico on public.parceiros
  for each row execute function public.bloqueia_contato_texto('nome_publico', 'rigoroso');
drop trigger if exists contato_parceiro_descricao on public.parceiros;
create trigger contato_parceiro_descricao before update of descricao on public.parceiros
  for each row execute function public.bloqueia_contato_texto('descricao', 'rigoroso');
drop trigger if exists contato_parceiro_descricao_curta on public.parceiros;
create trigger contato_parceiro_descricao_curta before update of descricao_curta on public.parceiros
  for each row execute function public.bloqueia_contato_texto('descricao_curta', 'rigoroso');

insert into supabase_migrations.schema_migrations (version, name)
select '20261122000357', '0357_pagina_do_parceiro_sem_contato_e1112'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261122000357');
commit;
