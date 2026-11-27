-- Viva Nomads — aplicar 0352 (E1064, perna 1). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- Cadastrar o PRIMEIRO CPF (de vazio para um número) deixa de vencer a identidade. A regra decidida em 18/10 continua:
-- TROCOU o nome ou o CPF → o laudo deixa de valer e a pessoa verifica de novo.
-- Só a função do gatilho muda; nenhum dado é alterado. Laudos que já venceram por este caminho NÃO voltam sozinhos:
-- a pessoa confirma a identidade de novo.
-- Rollback: supabase/producao/rollback/0352_rollback.sql
begin;
set local lock_timeout = '5s';

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

insert into supabase_migrations.schema_migrations (version, name)
select '20261122000352', '0352_caf_primeiro_cpf_nao_e_troca_e1064'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261122000352');
commit;
