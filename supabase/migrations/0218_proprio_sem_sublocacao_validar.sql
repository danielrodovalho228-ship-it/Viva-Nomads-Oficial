-- 0218 — 59-C1, item 4 (OK do Daniel, 23/10 08:53 CDT): as linhas antigas "imóvel próprio com sublocação autorizada"
-- voltam ao permitido e a restrição da 0200 passa a valer para todas as linhas (VALIDATE).
-- Em produção são 2: 4a693a63-8f4e-453c-a888-cd0ea9ccc4ff (rascunho) e ddf86c66-a214-463d-8563-66a5204010b5 (ativo).
-- Imóvel próprio não tem sublocação: só o booleano muda. Sem dados pessoais. Idempotente.
update public.properties
   set sublease_authorized = false
 where ownership_type = 'own'
   and sublease_authorized is true;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'properties_proprio_sem_sublocacao' and conrelid = 'public.properties'::regclass and not convalidated
  ) then
    alter table public.properties validate constraint properties_proprio_sem_sublocacao;
  end if;
end $$;
