-- 0339 — E790 (regra E445): contato nunca é revelado, em nenhuma fase. `property_private_details` (0052) devolvia o
-- telefone e o e-mail do responsável local do imóvel também ao morador com candidatura ACEITA — qualquer morador aceito
-- podia chamar a RPC com a própria sessão e ler o contato. O app só usa a RPC nas telas do dono; agora o banco também
-- só entrega o contato do responsável local ao DONO e ao admin. O morador aceito continua recebendo o endereço exato
-- (o endereço exato já é dado do morador aceito e não é contato) e nada de draft_data (já era só do dono).
-- Mesma assinatura e mesmos grants; idempotente. Desfazer: supabase/producao/rollback/0339_rollback.sql.
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
