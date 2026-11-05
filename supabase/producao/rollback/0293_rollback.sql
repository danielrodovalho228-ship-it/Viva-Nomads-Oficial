-- Rollback da 0293: a tabela volta a 16–30 = 6% e 31+ = 6% (negociável); sai a faixa de 4%. Recalcula a faixa dos
-- donos. Volte o código junto (o código do E564 trata a faixa sem teto como Gestor e a administradora a 4%).
begin;
set local lock_timeout = '5s';
delete from public.faixas_comissao where min_imoveis = 20;
update public.faixas_comissao set max_imoveis = 30 where min_imoveis = 16;
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values (31, null, 0.06)
on conflict (min_imoveis) do update set max_imoveis = excluded.max_imoveis, taxa = excluded.taxa;
select public.atualizar_faixas_dos_donos();
delete from supabase_migrations.schema_migrations where version = '20261105000293';
commit;
