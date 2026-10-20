-- 0164 — Prompt 22, item 5 (decisão do Daniel, 18/10): a identidade (CAF) vale 12 MESES, com 1 consulta por 12 meses,
-- e precisa ser refeita quando a pessoa troca o NOME ou o CPF. A validade e a cota ficam no código
-- (src/app/api/caf/verify); aqui fica a regra da troca, no banco, para valer em qualquer caminho (Conta, suporte, admin):
-- trocou full_name ou cpf → o laudo em vigor deixa de valer e a cota de consulta é liberada. Idempotente.
create or replace function public.caf_reverificar_por_troca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.full_name is distinct from old.full_name or new.cpf is distinct from old.cpf then
    -- O laudo da identidade valia para o nome/CPF antigos: deixa de valer agora.
    update public.tenant_verifications
       set valid_until = now()
     where tenant_id = new.id
       and (valid_until is null or valid_until > now());
    -- E a pessoa pode verificar de novo já (a cota é 1 consulta por 12 meses).
    delete from public.limites_uso where chave = 'caf:user:' || new.id::text;
  end if;
  return new;
end;
$$;
revoke all on function public.caf_reverificar_por_troca() from public, anon, authenticated;

drop trigger if exists caf_reverificar_por_troca on public.profiles;
create trigger caf_reverificar_por_troca after update of full_name, cpf on public.profiles
  for each row execute function public.caf_reverificar_por_troca();
