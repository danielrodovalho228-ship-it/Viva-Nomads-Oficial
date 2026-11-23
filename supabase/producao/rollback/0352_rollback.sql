-- Viva Nomads — rollback da 0352 (E1064, perna 1): devolve a função do gatilho como na 0164. Nunca roda sozinho.
-- Com ela, qualquer mudança de CPF (inclusive o primeiro cadastro) volta a vencer a identidade.
begin;
set local lock_timeout = '5s';
create or replace function public.caf_reverificar_por_troca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.full_name is distinct from old.full_name or new.cpf is distinct from old.cpf then
    update public.tenant_verifications
       set valid_until = now()
     where tenant_id = new.id
       and (valid_until is null or valid_until > now());
    delete from public.limites_uso where chave = 'caf:user:' || new.id::text;
  end if;
  return new;
end;
$$;
revoke all on function public.caf_reverificar_por_troca() from public, anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261122000352';
commit;
