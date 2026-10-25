-- Viva Nomads — 0170: "Limpezas por mês que posso incluir" vazio = sem limite (complemento do prompt 27, parte B).
-- Todo limpezas_max = 0 gravado veio do defeito Number(null) = 0 → null (sem limite). Idempotente.
-- Rollback: supabase/producao/rollback/0170_rollback.sql (devolve o 0 às linhas guardadas).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

create table if not exists public._bkp_0170_limpezas_max (property_id uuid primary key, limpezas_max integer not null);
alter table public._bkp_0170_limpezas_max enable row level security;
revoke all on public._bkp_0170_limpezas_max from anon, authenticated;
insert into public._bkp_0170_limpezas_max (property_id, limpezas_max)
select property_id, limpezas_max from public.property_negociacao_limites where limpezas_max = 0
on conflict (property_id) do nothing;
update public.property_negociacao_limites set limpezas_max = null where limpezas_max = 0;
-- Sem mínimo e sem limite de limpezas, a linha não diz nada (o servidor já apaga nesse caso ao salvar).
delete from public.property_negociacao_limites where valor_minimo is null and limpezas_max is null
  and property_id in (select property_id from public._bkp_0170_limpezas_max);

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000170', '0170_limpezas_max_sem_limite',
       array['-- conteúdo em supabase/migrations/0170_limpezas_max_sem_limite.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000170');
commit;
