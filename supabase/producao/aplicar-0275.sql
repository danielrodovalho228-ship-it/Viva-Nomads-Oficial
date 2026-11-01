-- Viva Nomads — aplicar 0275 (E375-B: resumo semanal — data da publicação, quedas do total por mês e o evento
-- 'resumo_semanal' na fila dos proativos). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- Rollback: supabase/producao/rollback/0275_rollback.sql.
begin;
set local lock_timeout = '5s';

-- ── 1. Data da primeira publicação ──────────────────────────────────────────────────────────────────────────────
alter table public.properties add column if not exists publicado_em timestamptz;
comment on column public.properties.publicado_em is
  'E375-B: quando o anúncio ficou ativo pela primeira vez (gravado pelo gatilho desde a 0275; nulo nos anteriores).';

create or replace function public.properties_marcar_publicacao() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'active' and new.publicado_em is null
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    new.publicado_em := now();
  end if;
  return new;
end
$$;
drop trigger if exists properties_marcar_publicacao on public.properties;
create trigger properties_marcar_publicacao before insert or update of status on public.properties
  for each row execute function public.properties_marcar_publicacao();
create index if not exists properties_publicado_em on public.properties (publicado_em) where publicado_em is not null;

-- ── 2. Quedas do total por mês ──────────────────────────────────────────────────────────────────────────────────
create table if not exists public.quedas_preco (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  total_antigo numeric(12, 2) not null check (total_antigo > 0),
  total_novo numeric(12, 2) not null check (total_novo >= 0),
  registrada_em timestamptz not null default now(),
  check (total_novo < total_antigo)
);
create index if not exists quedas_preco_recentes on public.quedas_preco (registrada_em desc);
create index if not exists quedas_preco_imovel on public.quedas_preco (property_id, registrada_em desc);
alter table public.quedas_preco enable row level security;
revoke all on public.quedas_preco from anon, authenticated;
comment on table public.quedas_preco is
  'E375-B: queda do total por mês (valor mensal + condomínio + contas fixas) de anúncio publicado. Só o servidor lê e grava.';

-- O total por mês do cartão (totalMesDaLinha em src/lib/precos.ts): contas só entram quando o valor é fixo.
create or replace function public.total_mes_do_imovel(p_mensal numeric, p_condominio numeric, p_modo text, p_contas numeric)
returns numeric language sql immutable as $$
  select coalesce(p_mensal, 0) + coalesce(p_condominio, 0) + case when p_modo = 'fixed' then coalesce(p_contas, 0) else 0 end
$$;

create or replace function public.properties_registrar_queda() returns trigger
language plpgsql set search_path = public as $$
declare
  v_antes numeric := public.total_mes_do_imovel(old.monthly_price, old.condo_fee, old.utilities_mode::text, old.utilities_estimate);
  v_agora numeric := public.total_mes_do_imovel(new.monthly_price, new.condo_fee, new.utilities_mode::text, new.utilities_estimate);
begin
  -- Só anúncio que JÁ estava publicado e continua publicado (ajuste de rascunho não é "baixou o valor").
  if old.status = 'active' and new.status = 'active' and v_antes > 0 and v_agora < v_antes then
    insert into public.quedas_preco (property_id, total_antigo, total_novo) values (new.id, v_antes, v_agora);
  end if;
  return null;
end
$$;
drop trigger if exists properties_registrar_queda on public.properties;
create trigger properties_registrar_queda after update of monthly_price, condo_fee, utilities_mode, utilities_estimate on public.properties
  for each row execute function public.properties_registrar_queda();

-- ── 3. O resumo semanal entra na fila dos proativos ─────────────────────────────────────────────────────────────
alter table public.emails_proativos drop constraint if exists emails_proativos_evento_check;
alter table public.emails_proativos add constraint emails_proativos_evento_check
  check (evento in ('pedido_imovel_novo', 'saved_search_match', 'pedido_compativel', 'pedido_expirando', 'resumo_semanal'));

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261101000275', '0275_resumo_semanal', array['-- conteúdo em supabase/migrations/0275_resumo_semanal.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261101000275');
commit;
