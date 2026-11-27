-- Viva Nomads — aplicar 0344 (prompt 078: a escada termina em 16 ou mais = 6%; sai a faixa de 20+ a 4%). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (depois da 0293). Rollback: supabase/producao/rollback/0344_rollback.sql.
begin;
set local lock_timeout = '5s';

-- 1) Sai a faixa de 20+ (Plano Gestor, 4%). A antiga "31+" (pré-0293) também não pode sobrar.
delete from public.faixas_comissao where min_imoveis in (20, 31);
-- 2) A escada inteira, com a última faixa sem teto: 16 ou mais = 6%.
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values
  (1, 2, 0.12), (3, 5, 0.10), (6, 15, 0.08), (16, null, 0.06)
on conflict (min_imoveis) do update set max_imoveis = excluded.max_imoveis, taxa = excluded.taxa;
-- 3) A faixa de cada dono com a tabela nova (0292).
select public.atualizar_faixas_dos_donos();

insert into supabase_migrations.schema_migrations (version, name)
select '20261116000344', '0344_escada_sem_gestor_078'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261116000344');
commit;
