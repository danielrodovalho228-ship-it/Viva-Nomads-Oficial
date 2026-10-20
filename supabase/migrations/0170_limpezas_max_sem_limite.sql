-- Viva Nomads — 0170: "Limpezas por mês que posso incluir" vazio = sem limite (complemento do prompt 27, parte B).
-- Até aqui o servidor gravava o campo vazio como 0 (Number(null) = 0), o que bloqueava qualquer limpeza a mais.
-- A tela nunca ofereceu "nenhuma" como escolha separada: todo 0 gravado veio desse defeito. Vira null (sem limite).
-- As linhas alteradas ficam guardadas para o rollback devolver exatamente o que era.
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
