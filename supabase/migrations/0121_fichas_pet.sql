-- 0121: ficha do pet do morador (ordem 022afabb, item 1, parte 1: sem fotos).
-- Até 3 por conta; só a própria pessoa lê e escreve (RLS). Validação de formato no servidor.
create table if not exists public.pets_inquilino (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  especie text not null check (especie in ('cao','gato','outro')),
  porte text not null check (porte in ('P','M','G')),
  idade_anos int not null check (idade_anos between 0 and 40),
  raca text not null default '' check (char_length(raca) <= 40),
  castrado boolean not null,
  vacinas_em_dia boolean not null,
  observacoes text not null default '' check (char_length(observacoes) <= 200),
  criado_em timestamptz not null default now()
);
create index if not exists pets_inquilino_user_idx on public.pets_inquilino (user_id);
alter table public.pets_inquilino enable row level security;
drop policy if exists pets_inquilino_proprio on public.pets_inquilino;
create policy pets_inquilino_proprio on public.pets_inquilino
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.pets_inquilino_limite() returns trigger language plpgsql as $f$
begin
  if (select count(*) from public.pets_inquilino where user_id = new.user_id) >= 3 then
    raise exception 'Limite de 3 pets por conta';
  end if;
  return new;
end $f$;
drop trigger if exists pets_inquilino_limite on public.pets_inquilino;
create trigger pets_inquilino_limite before insert on public.pets_inquilino
  for each row execute function public.pets_inquilino_limite();
