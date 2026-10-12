-- Viva Nomads — 0110: conferência de entrada e de saída do imóvel (ordem 404cd213, item 1, parte 1).
-- Idempotente e sem NOTICE. Sem dados pessoais. Produção: supabase/producao/aplicar-0110.sql (Action no merge).
-- Rollback: supabase/producao/rollback/0110_rollback.sql.
-- Cada contrato tem no máximo uma conferência de entrada e uma de saída. Proprietário e inquilino
-- registram itens por cômodo (com foto opcional); cada parte confirma ou contesta UMA vez; depois da
-- primeira resposta nada mais muda (trigger — vale também para o service_role). Toda escrita passa
-- pelo servidor depois de conferir que quem age é uma das partes; as partes só leem (RLS).
do $$
begin
  if to_regclass('public.conferencias') is null then
    create table public.conferencias (
      id uuid primary key default gen_random_uuid(),
      contrato_id uuid not null references public.contratos (id) on delete cascade,
      tipo text not null check (tipo in ('entrada', 'saida')),
      aberta_por uuid references auth.users (id) on delete set null,
      criada_em timestamptz not null default now(),
      unique (contrato_id, tipo)
    );
  end if;
  if to_regclass('public.conferencia_itens') is null then
    create table public.conferencia_itens (
      id uuid primary key default gen_random_uuid(),
      conferencia_id uuid not null references public.conferencias (id) on delete cascade,
      autor_id uuid references auth.users (id) on delete set null,
      parte text not null check (parte in ('proprietario', 'inquilino')),
      comodo text not null check (length(btrim(comodo)) between 1 and 60),
      descricao text not null check (length(btrim(descricao)) between 1 and 300),
      foto_path text check (foto_path is null or foto_path ~ '^[0-9a-zA-Z-]+/[0-9a-zA-Z._-]+$'),
      criado_em timestamptz not null default now()
    );
    create index conferencia_itens_conf_idx on public.conferencia_itens (conferencia_id, criado_em);
  end if;
  if to_regclass('public.conferencia_respostas') is null then
    create table public.conferencia_respostas (
      conferencia_id uuid not null references public.conferencias (id) on delete cascade,
      parte text not null check (parte in ('proprietario', 'inquilino')),
      autor_id uuid references auth.users (id) on delete set null,
      decisao text not null check (decisao in ('confirmou', 'contestou')),
      motivo text check (motivo is null or length(motivo) <= 1000),
      decidido_em timestamptz not null default now(),
      primary key (conferencia_id, parte),
      check (decisao <> 'contestou' or length(btrim(coalesce(motivo, ''))) > 0)
    );
  end if;
end;
$$;

comment on table public.conferencias is 'Conferência de entrada/saída do imóvel por contrato. Só o servidor grava; as partes leem.';
comment on table public.conferencia_itens is 'Itens e fotos por cômodo. Congelados depois da primeira resposta.';
comment on table public.conferencia_respostas is 'Confirmação ou contestação de cada parte, com data/hora. Imutável.';

-- Respostas: nunca mudam nem somem (nem pelo service_role); a cascata do contrato é a única saída.
create or replace function public.conferencia_respostas_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and pg_trigger_depth() = 1 then
    raise exception 'A resposta da conferência não pode ser alterada.';
  end if;
  return coalesce(new, old);
end;
$$;

-- Itens: depois da primeira resposta não entram, não mudam e não saem.
create or replace function public.conferencia_itens_trava() returns trigger
language plpgsql set search_path = public as $$
declare cid uuid := coalesce(new.conferencia_id, old.conferencia_id);
begin
  if pg_trigger_depth() = 1 and exists (select 1 from public.conferencia_respostas r where r.conferencia_id = cid) then
    raise exception 'A conferência já foi respondida e não pode mais ser alterada.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace trigger conferencia_respostas_imutavel before update or delete on public.conferencia_respostas
  for each row execute function public.conferencia_respostas_imutavel();
create or replace trigger conferencia_itens_trava before insert or update or delete on public.conferencia_itens
  for each row execute function public.conferencia_itens_trava();

alter table public.conferencias enable row level security;
alter table public.conferencia_itens enable row level security;
alter table public.conferencia_respostas enable row level security;
revoke all on public.conferencias from anon, authenticated;
revoke all on public.conferencia_itens from anon, authenticated;
revoke all on public.conferencia_respostas from anon, authenticated;
grant select on public.conferencias, public.conferencia_itens, public.conferencia_respostas to authenticated;
grant all on public.conferencias, public.conferencia_itens, public.conferencia_respostas to service_role;

-- Leitura: o inquilino do contrato, o proprietário do imóvel e a equipe.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conferencias' and policyname = 'conferencia: partes e equipe') then
    create policy "conferencia: partes e equipe" on public.conferencias for select to authenticated using (
      public.is_admin() or exists (
        select 1 from public.contratos c join public.properties p on p.id = c.property_id
         where c.id = conferencias.contrato_id and (c.tenant_id = auth.uid() or p.owner_id = auth.uid())
      )
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conferencia_itens' and policyname = 'conferencia itens: partes e equipe') then
    create policy "conferencia itens: partes e equipe" on public.conferencia_itens for select to authenticated using (
      exists (select 1 from public.conferencias f where f.id = conferencia_itens.conferencia_id)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conferencia_respostas' and policyname = 'conferencia respostas: partes e equipe') then
    create policy "conferencia respostas: partes e equipe" on public.conferencia_respostas for select to authenticated using (
      exists (select 1 from public.conferencias f where f.id = conferencia_respostas.conferencia_id)
    );
  end if;
end;
$$;
