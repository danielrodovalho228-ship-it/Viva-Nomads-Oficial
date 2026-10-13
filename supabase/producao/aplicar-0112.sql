-- Viva Nomads — aplicar 0112 (F22: chamado sem resposta de pessoa volta para "Aberto", ordem d437e6f2).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0112_rollback.sql (não há o que desfazer: é uma correção de dado).
begin;
set local lock_timeout = '5s';

update public.chamados c
   set status = 'aberto'
 where c.status = 'aguardando_usuario'
   and not exists (
     select 1 from public.chamado_mensagens m
      where m.chamado_id = c.id and m.autor = 'admin' and coalesce(m.interno, false) = false
   );

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261013000112', '0112_chamados_aberto_sem_resposta_humana',
       array['-- conteúdo em supabase/migrations/0112_chamados_aberto_sem_resposta_humana.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261013000112');
commit;
