-- Viva Nomads — aplicar 0254 (E227-B: parceiros_interesse vira legado só de leitura). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0254_rollback.sql.
begin;
set local lock_timeout = '5s';

-- Parceria tem UMA fila (parceiro_solicitacoes, 0190). A tabela antiga fica (retenção e exclusão de conta seguem
-- pelo service_role), mas anon/authenticated não gravam, não mudam e não apagam mais nada nela. revoke é idempotente.
revoke insert, update, delete on public.parceiros_interesse from anon, authenticated;
comment on table public.parceiros_interesse is 'Legado — fonte única: parceiro_solicitacoes (0190). Sai pela política de retenção.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261029000254', '0254_parceiros_interesse_legado', array['-- conteúdo em supabase/migrations/0254_parceiros_interesse_legado.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261029000254');
commit;
