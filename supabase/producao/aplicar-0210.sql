-- Viva Nomads — aplicar 0210 (padrão mínimo de conforto + prazo de solução da manutenção — Prompt 59). Idempotente. Rollback: supabase/producao/rollback/0210_rollback.sql.
begin;
set local lock_timeout = '5s';
-- 0210 — Prompt 59, Fase 1: padrão mínimo de conforto + prazo de solução da manutenção (D1–D7). Reaplicar é seguro.
--
--  Parte A (conforto)
--   1. conforto_chaves(): a lista da versão atual (espelho de src/config/conforto-minimo.ts; teste de guarda compara).
--   2. conforto_declaracoes: o dono confirma cada item (por imóvel). Só o servidor grava; o dono e o admin leem.
--   3. properties_exige_conforto: publicar (passar a 'active') numa sessão de usuário exige todos os itens confirmados.
--      O servidor também confere antes e devolve a lista do que falta; aqui é a trava para quem contorna a tela.
--   4. conforto_adequacao: anúncio já publicado no dia da regra ganha prazo de 30 dias (D4); o cron lembra aos 15 e
--      aos 3 dias e pausa o vencido (sai da busca); volta ao confirmar. Contas de teste seguem a mesma regra.
--   5. conferencia_conforto: seção "Padrão mínimo" da conferência de ENTRADA (morador), travada depois do fechamento
--      (entra no mesmo hash, montado no servidor).
--   6. conforto_pendencias: "não confere" vira pendência do dono (72 h; morador confirma ou reabre em 48 h; contestação
--      decidida pelo atendimento da Viva).
--  Parte B (manutenção)
--   7. service_orders: provisória, solução marcada/confirmada, reabertura e reclassificação (só admin, com motivo).
--      Trava: numa sessão de usuário que não é admin, prioridade e reclassificação não mudam; as marcações do dono só
--      podem levar a hora de agora (nada de data no passado).
--   8. service_order_eventos: novos tipos (provisoria, reaberta, confirmada, reclassificada, pedido_reclassificacao, aviso).
--   9. Cron de 15 min (pg_cron + pg_net, padrão da 0073) chamando /api/cron/prazos-conforto; a Vercel cobre 1×/dia.
--  Nada financeiro (D7): nenhuma coluna de valor, multa, abatimento ou rescisão.

-- ── 1. Lista atual ───────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.conforto_chaves()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['cama_colchao', 'roupa_cama_banho', 'agua_quente', 'cozinha_basica', 'ventilacao_quartos',
               'iluminacao', 'fechadura_entrada', 'entrega_limpa', 'internet_informada', 'mobilia_das_fotos']::text[];
$$;
grant execute on function public.conforto_chaves() to anon, authenticated, service_role;

-- ── 2. Declarações do dono ───────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.conforto_declaracoes (
  property_id uuid not null references public.properties (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z_]{3,40}$'),
  confirmado boolean not null default false,
  confirmado_por uuid references auth.users (id) on delete set null,
  confirmado_em timestamptz,
  versao_lista integer not null default 1 check (versao_lista >= 1),
  primary key (property_id, chave)
);
create index if not exists conforto_declaracoes_confirmado_por_idx on public.conforto_declaracoes (confirmado_por);
alter table public.conforto_declaracoes enable row level security;
revoke all on public.conforto_declaracoes from anon, authenticated;
grant select on public.conforto_declaracoes to authenticated;
grant all on public.conforto_declaracoes to service_role;
drop policy if exists "conforto: dono e equipe leem" on public.conforto_declaracoes;
create policy "conforto: dono e equipe leem" on public.conforto_declaracoes for select to authenticated using (
  public.is_admin() or exists (select 1 from public.properties p where p.id = conforto_declaracoes.property_id and p.owner_id = auth.uid())
);

create or replace function public.conforto_completo(p_property uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct d.chave) = cardinality(public.conforto_chaves())
    from public.conforto_declaracoes d
   where d.property_id = p_property and d.confirmado and d.chave = any (public.conforto_chaves());
$$;
revoke all on function public.conforto_completo(uuid) from public, anon;
grant execute on function public.conforto_completo(uuid) to authenticated, service_role;

-- ── 3. Trava da publicação (sessão de usuário) ───────────────────────────────────────────────────────────────────
create or replace function public.properties_exige_conforto() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status::text = 'active'
     and old.status::text is distinct from 'active'
     and current_user = 'authenticated'
     and pg_trigger_depth() <= 1
     and not public.conforto_completo(new.id)
  then
    raise exception 'Para publicar, confirme o padrão mínimo de conforto.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_properties_exige_conforto on public.properties;
create trigger trg_properties_exige_conforto
  before update of status on public.properties
  for each row execute function public.properties_exige_conforto();

-- ── 4. Prazo de adequação dos anúncios já publicados (D4) ────────────────────────────────────────────────────────
create table if not exists public.conforto_adequacao (
  property_id uuid primary key references public.properties (id) on delete cascade,
  prazo_ate timestamptz not null,
  lembretes integer[] not null default '{}',
  pausado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.conforto_adequacao enable row level security;
revoke all on public.conforto_adequacao from anon, authenticated;
grant select on public.conforto_adequacao to authenticated;
grant all on public.conforto_adequacao to service_role;
drop policy if exists "adequacao: dono e equipe leem" on public.conforto_adequacao;
create policy "adequacao: dono e equipe leem" on public.conforto_adequacao for select to authenticated using (
  public.is_admin() or exists (select 1 from public.properties p where p.id = conforto_adequacao.property_id and p.owner_id = auth.uid())
);
-- No dia em que a regra vai ao ar: todo anúncio publicado ganha 30 dias (reaplicar não muda o prazo já dado).
insert into public.conforto_adequacao (property_id, prazo_ate)
select p.id, now() + interval '30 days'
  from public.properties p
 where p.status::text = 'active'
on conflict (property_id) do nothing;

-- ── 5. Seção "Padrão mínimo" da conferência de entrada ───────────────────────────────────────────────────────────
create table if not exists public.conferencia_conforto (
  conferencia_id uuid not null references public.conferencias (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z_]{3,40}$'),
  confere boolean not null,
  texto text check (texto is null or char_length(texto) between 1 and 280),
  foto_path text,
  autor_id uuid references auth.users (id) on delete set null,
  respondido_em timestamptz not null default now(),
  primary key (conferencia_id, chave),
  constraint conferencia_conforto_texto_quando_nao_confere check (confere or texto is not null)
);
create index if not exists conferencia_conforto_autor_idx on public.conferencia_conforto (autor_id);
alter table public.conferencia_conforto enable row level security;
revoke all on public.conferencia_conforto from anon, authenticated;
grant select on public.conferencia_conforto to authenticated;
grant all on public.conferencia_conforto to service_role;
drop policy if exists "conferencia conforto: partes e equipe" on public.conferencia_conforto;
create policy "conferencia conforto: partes e equipe" on public.conferencia_conforto for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.conferencias c
      join public.contratos k on k.id = c.contrato_id
      join public.properties p on p.id = k.property_id
     where c.id = conferencia_conforto.conferencia_id and (k.tenant_id = auth.uid() or p.owner_id = auth.uid())
  )
);
create or replace function public.conferencia_conforto_trava() returns trigger
language plpgsql set search_path = public as $$
declare
  fechada timestamptz;
  conf uuid := coalesce(new.conferencia_id, old.conferencia_id);
begin
  select c.fechada_em into fechada from public.conferencias c where c.id = conf;
  if fechada is not null then
    raise exception 'Conferência fechada: o padrão mínimo não muda mais.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_conferencia_conforto_trava on public.conferencia_conforto;
create trigger trg_conferencia_conforto_trava
  before insert or update or delete on public.conferencia_conforto
  for each row execute function public.conferencia_conforto_trava();

-- ── 6. Pendências do dono ────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.conforto_pendencias (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  contrato_id uuid references public.contratos (id) on delete set null,
  conferencia_id uuid references public.conferencias (id) on delete set null,
  chave text not null check (chave ~ '^[a-z_]{3,40}$'),
  status text not null default 'aberta' check (status in ('aberta', 'corrigida', 'contestada', 'procedente', 'improcedente')),
  aberta_em timestamptz not null default now(),
  prazo_ate timestamptz not null,
  texto_morador text check (texto_morador is null or char_length(texto_morador) <= 280),
  foto_morador text,
  corrigida_em timestamptz,
  foto_dono text,
  confirmada_em timestamptz,
  reaberta_em timestamptz,
  contestada_em timestamptz,
  motivo_contestacao text check (motivo_contestacao is null or char_length(motivo_contestacao) <= 500),
  decidido_por uuid references auth.users (id) on delete set null,
  decidido_em timestamptz,
  constraint conforto_pendencias_decisao check ((status in ('procedente', 'improcedente')) = (decidido_em is not null))
);
create unique index if not exists conforto_pendencias_uma_por_item on public.conforto_pendencias (conferencia_id, chave) where conferencia_id is not null;
create index if not exists conforto_pendencias_property_idx on public.conforto_pendencias (property_id, status);
create index if not exists conforto_pendencias_contrato_idx on public.conforto_pendencias (contrato_id);
create index if not exists conforto_pendencias_decidido_por_idx on public.conforto_pendencias (decidido_por);
alter table public.conforto_pendencias enable row level security;
revoke all on public.conforto_pendencias from anon, authenticated;
grant select on public.conforto_pendencias to authenticated;
grant all on public.conforto_pendencias to service_role;
drop policy if exists "pendencias conforto: partes e equipe" on public.conforto_pendencias;
create policy "pendencias conforto: partes e equipe" on public.conforto_pendencias for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.properties p where p.id = conforto_pendencias.property_id and p.owner_id = auth.uid())
  or exists (select 1 from public.contratos k where k.id = conforto_pendencias.contrato_id and k.tenant_id = auth.uid())
);

-- ── 7. Manutenção: prazo de solução ──────────────────────────────────────────────────────────────────────────────
alter table public.service_orders add column if not exists provisoria_em timestamptz;
alter table public.service_orders add column if not exists solucao_marcada_em timestamptz;
alter table public.service_orders add column if not exists solucao_confirmada_em timestamptz;
alter table public.service_orders add column if not exists reaberta_em timestamptz;
alter table public.service_orders add column if not exists reclassificada_por uuid references auth.users (id) on delete set null;
alter table public.service_orders add column if not exists reclassificada_em timestamptz;
alter table public.service_orders add column if not exists prioridade_original public.so_priority;
alter table public.service_orders add column if not exists reclassificacao_motivo text;
alter table public.service_orders add column if not exists reclassificacao_pedida_em timestamptz;
create index if not exists service_orders_reclassificada_por_idx on public.service_orders (reclassificada_por);

create or replace function public.service_orders_protege_prazos() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or pg_trigger_depth() > 1 or public.is_admin() then
    return new;
  end if;
  if new.priority is distinct from old.priority
     or new.prioridade_original is distinct from old.prioridade_original
     or new.reclassificada_por is distinct from old.reclassificada_por
     or new.reclassificada_em is distinct from old.reclassificada_em
     or new.reclassificacao_motivo is distinct from old.reclassificacao_motivo
     or new.opened_at is distinct from old.opened_at
     or new.solucao_confirmada_em is distinct from old.solucao_confirmada_em
     or new.reaberta_em is distinct from old.reaberta_em
  then
    raise exception 'Só o atendimento da Viva muda a prioridade e os prazos da ordem.' using errcode = '42501';
  end if;
  if (new.provisoria_em is distinct from old.provisoria_em and new.provisoria_em is not null and abs(extract(epoch from (new.provisoria_em - now()))) > 300)
     or (new.solucao_marcada_em is distinct from old.solucao_marcada_em and new.solucao_marcada_em is not null and abs(extract(epoch from (new.solucao_marcada_em - now()))) > 300)
  then
    raise exception 'A marcação do proprietário leva a hora de agora.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_service_orders_protege_prazos on public.service_orders;
create trigger trg_service_orders_protege_prazos
  before update on public.service_orders
  for each row execute function public.service_orders_protege_prazos();

-- ── 8. Histórico: novos tipos ────────────────────────────────────────────────────────────────────────────────────
alter table public.service_order_eventos drop constraint if exists service_order_eventos_tipo_check;
alter table public.service_order_eventos add constraint service_order_eventos_tipo_check
  check (tipo in ('aberto', 'status', 'provisoria', 'reaberta', 'confirmada', 'reclassificada', 'pedido_reclassificacao', 'aviso'));
alter table public.service_order_eventos drop constraint if exists service_order_eventos_papel_check;
alter table public.service_order_eventos add constraint service_order_eventos_papel_check
  check (papel in ('inquilino', 'proprietario', 'sistema', 'admin'));

-- ── 9. Cron de 15 min ────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.prazos_conforto_tique()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo text;
  site text;
begin
  begin
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'cron_secret';
    select decrypted_secret into site from vault.decrypted_secrets where name = 'site_url';
    if segredo is not null and site is not null and to_regproc('net.http_get') is not null then
      perform net.http_get(
        url := site || '/api/cron/prazos-conforto',
        headers := jsonb_build_object('Authorization', 'Bearer ' || segredo)
      );
    end if;
  exception when others then
    raise notice 'prazos_conforto_tique: rota não chamada (%).', sqlerrm;
  end;
end;
$$;
revoke all on function public.prazos_conforto_tique() from public, anon, authenticated;

do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('prazos-conforto')
    where exists (select 1 from cron.job where jobname = 'prazos-conforto');
  perform cron.schedule('prazos-conforto', '*/15 * * * *', 'select public.prazos_conforto_tique();');
exception when others then
  raise notice 'pg_cron indisponível (%). O cron diário da Vercel cobre os prazos.', sqlerrm;
end $cron$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261022000210', '0210_conforto_manutencao',
       array['-- conteúdo em supabase/migrations/0210_conforto_manutencao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261022000210');
commit;
