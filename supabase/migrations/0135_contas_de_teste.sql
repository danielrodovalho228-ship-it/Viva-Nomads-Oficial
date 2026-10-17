-- 0135 — Contas de teste (ordem 7436a29a, item 3).
-- profiles.is_teste marca as contas de QA/laboratório; chamados dessas contas nascem com
-- simulacao = true (as filas, o SLA, o escalonamento e os avisos à equipe já ignoram simulacao).
-- Só o servidor (service role / migração) liga is_teste: uma pessoa logada não consegue se marcar.
alter table public.profiles add column if not exists is_teste boolean not null default false;

create or replace function public.profiles_is_teste_so_servidor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'service_role') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_teste := false;
    else
      new.is_teste := old.is_teste;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_is_teste_guarda on public.profiles;
create trigger profiles_is_teste_guarda
  before insert or update on public.profiles
  for each row execute function public.profiles_is_teste_so_servidor();

create or replace function public.chamados_conta_de_teste()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.usuario_id is not null
     and exists (select 1 from public.profiles p where p.id = new.usuario_id and p.is_teste) then
    new.simulacao := true;
  end if;
  return new;
end;
$$;

drop trigger if exists chamados_conta_de_teste_tg on public.chamados;
create trigger chamados_conta_de_teste_tg
  before insert on public.chamados
  for each row execute function public.chamados_conta_de_teste();

-- Contas conhecidas: proprietario1@, inquilino1@, teste-qa@ e as do laboratório.
update public.profiles
   set is_teste = true
 where not is_teste
   and (lower(split_part(email, '@', 1)) in ('proprietario1', 'inquilino1', 'teste-qa')
        or lower(email) like '%@lab.vivanomads.test');
