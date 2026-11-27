-- 0352 — E1064, perna 1 (ORDEM-DUET-392/406): cadastrar o PRIMEIRO CPF não vence a identidade.
-- A regra da 0164 (decisão do Daniel, 18/10) é: TROCOU o nome ou o CPF → o laudo da identidade deixa de valer e a
-- pessoa verifica de novo. O gatilho disparava com qualquer mudança de CPF, inclusive de vazio para um número.
-- Numa conta real isso não acontece (a verificação exige o CPF antes). Numa conta de teste a verificação simulada não
-- pede CPF; o Fechamento pede o CPF do morador depois; ao cadastrá-lo, o laudo vencia na hora e o dono passava a ver
-- "Identidade pendente" (prova ao vivo de 20–21/11: laudo criado às 22:40 UTC e vencido às 22:46 UTC).
-- Aqui: só a FUNÇÃO muda. O gatilho, as tabelas e os dados ficam como estão; nenhum laudo é alterado na aplicação.
-- Rollback: supabase/producao/rollback/0352_rollback.sql
create or replace function public.caf_reverificar_por_troca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- TROCA: o nome mudou, ou o CPF que já existia mudou (ou saiu). Cadastrar o PRIMEIRO CPF (de vazio para um número)
  -- não é troca: não havia CPF a que o laudo estivesse ligado.
  if new.full_name is distinct from old.full_name
     or (old.cpf is not null and new.cpf is distinct from old.cpf) then
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
