-- Viva Nomads — aplicar 0164 (identidade: reverificar quando trocar nome ou CPF). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0164_rollback.sql.
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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000164', '0164_caf_reverificar_troca',
       array['-- conteúdo em supabase/migrations/0164_caf_reverificar_troca.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000164');
commit;
