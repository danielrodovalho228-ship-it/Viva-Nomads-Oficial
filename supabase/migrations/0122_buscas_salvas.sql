-- Buscas salvas (ordem d15ef6bf): o coração "Salvar busca" da /buscar. Cada
-- pessoa vê, cria e apaga só as próprias; até 20 por conta (conferido aqui e na
-- ação do servidor). `parametros` é a query string da busca (sem o "?").
-- Sem comandos que gerem NOTICE (reaplicar é seguro).
do $$
begin
  if to_regclass('public.buscas_salvas') is null then
    create table public.buscas_salvas (
      id uuid primary key default gen_random_uuid(),
      usuario_id uuid not null references auth.users (id) on delete cascade,
      parametros text not null check (char_length(parametros) <= 1000),
      resumo text not null check (char_length(btrim(resumo)) between 1 and 200),
      criado_em timestamptz not null default now(),
      unique (usuario_id, parametros)
    );
    create index buscas_salvas_usuario_idx on public.buscas_salvas (usuario_id, criado_em desc);
  end if;
end $$;

alter table public.buscas_salvas enable row level security;
revoke all on public.buscas_salvas from anon, authenticated;
grant select, insert, delete on public.buscas_salvas to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buscas_salvas' and policyname = 'buscas_salvas_ler') then
    create policy buscas_salvas_ler on public.buscas_salvas
      for select to authenticated using (usuario_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buscas_salvas' and policyname = 'buscas_salvas_criar') then
    create policy buscas_salvas_criar on public.buscas_salvas
      for insert to authenticated with check (usuario_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buscas_salvas' and policyname = 'buscas_salvas_apagar') then
    create policy buscas_salvas_apagar on public.buscas_salvas
      for delete to authenticated using (usuario_id = (select auth.uid()));
  end if;
end $$;

-- Limite de 20 buscas por conta (também no banco, não só na tela).
create or replace function public.buscas_salvas_limite() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.buscas_salvas where usuario_id = new.usuario_id) >= 20 then
    raise exception 'Limite de 20 buscas salvas' using errcode = '23514';
  end if;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'buscas_salvas_limite' and tgrelid = 'public.buscas_salvas'::regclass) then
    create trigger buscas_salvas_limite before insert on public.buscas_salvas
      for each row execute function public.buscas_salvas_limite();
  end if;
end $$;
