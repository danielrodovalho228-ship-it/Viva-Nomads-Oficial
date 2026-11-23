-- Rollback da 0344: a tabela volta ao estado da 0293 — 16–19 = 6% e 20+ = 4% (Plano Gestor). Recalcula a faixa dos donos.
-- Volte o código junto (o código do prompt 078 trata a faixa sem teto como "16 ou mais = 6%").
begin;
set local lock_timeout = '5s';
update public.faixas_comissao set max_imoveis = 19, taxa = 0.06 where min_imoveis = 16;
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values (20, null, 0.04)
on conflict (min_imoveis) do update set max_imoveis = excluded.max_imoveis, taxa = excluded.taxa;
select public.atualizar_faixas_dos_donos();
delete from supabase_migrations.schema_migrations where version = '20261116000344';
commit;
