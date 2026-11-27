-- Viva Nomads — aplicar 0293 (E564: Plano Gestor = faixa de 4% para 20+ imóveis; sai a faixa 31+ negociável). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (depois da 0292). Rollback: supabase/producao/rollback/0293_rollback.sql.
begin;
set local lock_timeout = '5s';

-- 1) A antiga faixa "31+ negociável" deixa de existir.
delete from public.faixas_comissao where min_imoveis = 31;
-- 2) 16–19 = 6% (antes 16–30).
update public.faixas_comissao set max_imoveis = 19 where min_imoveis = 16;
-- 3) 20+ = Plano Gestor, 4%, sem teto.
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values (20, null, 0.04)
on conflict (min_imoveis) do update set max_imoveis = excluded.max_imoveis, taxa = excluded.taxa;
-- 4) A faixa de cada dono com a tabela nova (0292). Quem sobe de faixa vale na hora; quem cai ganha a janela de 30 dias.
select public.atualizar_faixas_dos_donos();

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000293', '0293_faixa_gestor_4', array['-- conteúdo em supabase/migrations/0293_faixa_gestor_4.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000293');
commit;
