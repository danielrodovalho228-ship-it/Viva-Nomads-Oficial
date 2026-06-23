-- ════════════════════════════════════════════════════════════════════
-- Cria o perfil (public.profiles) automaticamente a cada novo usuário do
-- Supabase Auth. Sem isto, o cadastro não popula `profiles` — e o papel,
-- o guard de admin e a RLS (que dependem de profiles.role) não funcionam.
--
-- À PROVA DE FALHA: o insert do perfil NUNCA pode derrubar o signup. Por isso
-- roda em SECURITY DEFINER (ignora RLS), trata papel inválido sem erro de cast
-- e captura qualquer exceção (apenas avisa, não propaga). Se a produção já tinha
-- um trigger `on_auth_user_created` quebrado, este o substitui por um correto.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    -- Papel escolhido no cadastro; valor inválido/ausente → 'tenant' (sem cast quebrar).
    case
      when new.raw_user_meta_data ->> 'role' in ('owner', 'tenant', 'admin')
        then (new.raw_user_meta_data ->> 'role')::user_role
      else 'tenant'::user_role
    end
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    -- Nunca falha o cadastro por causa do perfil; só registra um aviso.
    raise warning 'handle_new_user: % (%):', sqlerrm, sqlstate;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
