-- 0200 — imóvel próprio não pode ter sublocação autorizada (ordem 51542f51, Pacote 11/10 #41).
-- A regra: ownership_type <> 'own' OR sublease_authorized IS NOT TRUE. A restrição nasce NOT VALID:
-- vale para gravações novas; as linhas antigas que a violam (2 rascunhos) só o Daniel corrige (nenhum dado é alterado aqui).
-- Sem dados pessoais. Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_proprio_sem_sublocacao' and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_proprio_sem_sublocacao
      check (ownership_type <> 'own' or sublease_authorized is not true) not valid;
  end if;
end $$;
