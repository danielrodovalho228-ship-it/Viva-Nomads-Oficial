-- Rollback da 0339: volta a property_private_details da 0052 (contato do responsável local também ao morador aceito).
begin;
create or replace function public.property_private_details(prop_id uuid)
returns table (exact_address text, responsavel_local_nome text, responsavel_local_telefone text, responsavel_local_email text, draft_data jsonb)
language sql
security definer
set search_path to 'public'
as $function$
  select p.exact_address, p.responsavel_local_nome, p.responsavel_local_telefone, p.responsavel_local_email,
    case when p.owner_id = auth.uid() then p.draft_data else null end
  from public.properties p
  where p.id = prop_id
    and (p.owner_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.leads l where l.property_id = p.id and l.tenant_id = auth.uid() and l.status = 'accepted'))
  limit 1;
$function$;
revoke all on function public.property_private_details(uuid) from public, anon;
grant execute on function public.property_private_details(uuid) to authenticated;
delete from supabase_migrations.schema_migrations where version = '20261111000339';
commit;
