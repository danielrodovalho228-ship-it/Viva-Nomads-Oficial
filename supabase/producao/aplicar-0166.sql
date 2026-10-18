-- Viva Nomads — aplicar 0166 (ia_chamadas.erro_resumo: mensagem do erro da API, até 300 caracteres). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0166_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.ia_chamadas add column if not exists erro_resumo text;
alter table public.ia_chamadas drop constraint if exists ia_chamadas_erro_resumo_tam;
alter table public.ia_chamadas add constraint ia_chamadas_erro_resumo_tam check (erro_resumo is null or char_length(erro_resumo) <= 300);

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000166', '0166_ia_chamadas_erro_resumo',
       array['-- conteúdo em supabase/migrations/0166_ia_chamadas_erro_resumo.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000166');
commit;
