-- Viva Nomads — rollback da 0254: devolve os grants de escrita da 0104 em parceiros_interesse e o comentário da 0190.
-- Idempotente. A linha da 0254 em schema_migrations sai junto, para a Action poder reaplicar.
begin;
set local lock_timeout = '5s';
grant insert (tipo, nome, cidade, uf, whatsapp, email, site, aceite_contato) on public.parceiros_interesse to anon, authenticated;
grant update on public.parceiros_interesse to authenticated;
comment on table public.parceiros_interesse is 'Copiada para parceiro_solicitacoes (0190). O formulário novo grava só em parceiro_solicitacoes.';
delete from supabase_migrations.schema_migrations where version = '20261029000254';
commit;
