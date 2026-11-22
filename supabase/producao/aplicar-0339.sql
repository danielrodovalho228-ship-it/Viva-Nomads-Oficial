-- Viva Nomads — aplicar 0339 (E790: contato do responsável local só para o dono e o admin). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0339_rollback.sql.
begin;
set local lock_timeout = '5s';

create or replace function public.property_private_details(prop_id uuid)
returns table (exact_address text, responsavel_local_nome text, responsavel_local_telefone text, responsavel_local_email text, draft_data jsonb)
language sql
security definer
set search_path to 'public'
as $function$
  select
    p.exact_address,
    case when p.owner_id = auth.uid() or public.is_admin() then p.responsavel_local_nome else null end,
    case when p.owner_id = auth.uid() or public.is_admin() then p.responsavel_local_telefone else null end,
    case when p.owner_id = auth.uid() or public.is_admin() then p.responsavel_local_email else null end,
    case when p.owner_id = auth.uid() then p.draft_data else null end
  from public.properties p
  where p.id = prop_id
    and (
      p.owner_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.leads l
        where l.property_id = p.id
          and l.tenant_id = auth.uid()
          and l.status = 'accepted'
      )
    )
  limit 1;
$function$;
revoke all on function public.property_private_details(uuid) from public, anon;
grant execute on function public.property_private_details(uuid) to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
select '20261111000339', '0339_contato_responsavel_so_dono_e790'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261111000339');

commit;
