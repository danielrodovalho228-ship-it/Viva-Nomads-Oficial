-- Alerta de busca salva (ordem cb9a09e9): avisa o morador por e-mail quando um
-- imóvel PUBLICADO combina com uma busca salva (0122). Cada pessoa liga/desliga
-- o alerta das próprias buscas; o registro de envios é só do servidor (idempotente:
-- o mesmo imóvel nunca é avisado duas vezes para a mesma busca).
-- Sem comandos que gerem NOTICE (reaplicar é seguro).
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'buscas_salvas' and column_name = 'alerta_ativo') then
    alter table public.buscas_salvas add column alerta_ativo boolean not null default true;
  end if;
end $$;

grant update (alerta_ativo) on public.buscas_salvas to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buscas_salvas' and policyname = 'buscas_salvas_alerta') then
    create policy buscas_salvas_alerta on public.buscas_salvas
      for update to authenticated
      using (usuario_id = (select auth.uid()))
      with check (usuario_id = (select auth.uid()));
  end if;
  if to_regclass('public.alertas_busca_envios') is null then
    create table public.alertas_busca_envios (
      busca_id uuid not null references public.buscas_salvas (id) on delete cascade,
      imovel_id uuid not null references public.properties (id) on delete cascade,
      criado_em timestamptz not null default now(),
      enviado_em timestamptz,
      primary key (busca_id, imovel_id)
    );
    create index alertas_busca_envios_pendentes_idx on public.alertas_busca_envios (busca_id) where enviado_em is null;
  end if;
end $$;

-- Só o servidor (service role) lê e grava os envios: RLS ligada, sem política e sem grant.
alter table public.alertas_busca_envios enable row level security;
revoke all on public.alertas_busca_envios from anon, authenticated;
