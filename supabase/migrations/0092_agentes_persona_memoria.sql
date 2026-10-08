-- 0092 — Central humana, parte 1: persona e memória dos agentes (pedido do Daniel, 08/10/2026).
--   • agentes.persona: perfil e jeito de falar de cada agente (o Moacir preenche depois do merge);
--   • agentes_memoria: fatos curtos que o Daniel contou sobre ele (gosto, rotina, preferência).
--     Só admin lê, grava e apaga; anon e usuário comum não têm acesso. Sem dado de terceiros:
--     o código recusa saúde, finanças, documentos e contatos antes de gravar.
-- Idempotente: reaplicar é seguro. Rollback: supabase/producao/rollback/0092_rollback.sql
alter table public.agentes add column if not exists persona text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agentes_persona_tamanho') then
    alter table public.agentes add constraint agentes_persona_tamanho check (persona is null or char_length(persona) <= 4000);
  end if;
end;
$$;

create table if not exists public.agentes_memoria (
  id uuid primary key default gen_random_uuid(),
  agente_slug text not null references public.agentes(slug) on delete cascade,
  fato text not null check (char_length(fato) between 1 and 500),
  criado_em timestamptz not null default now()
);
create index if not exists agentes_memoria_slug_data on public.agentes_memoria (agente_slug, criado_em desc);

alter table public.agentes_memoria enable row level security;
revoke all on public.agentes_memoria from anon, authenticated;
grant select, insert, delete on public.agentes_memoria to authenticated;

drop policy if exists agentes_memoria_admin_all on public.agentes_memoria;
create policy agentes_memoria_admin_all on public.agentes_memoria for all to authenticated using (public.is_admin()) with check (public.is_admin());
