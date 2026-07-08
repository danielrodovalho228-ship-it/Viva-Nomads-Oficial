-- ══════════════════════════════════════════════════════════════════════════
-- Ciclo de Vistorias e Encerramento (Dossiê Viva) — modelo de dados + RLS.
--
-- Prova imutável: vistoria assinada pelos DOIS lados fica selada (selada_em),
-- com hash sha-256 das fotos gravado. Storage privado (bucket vistoria-fotos)
-- com RLS: só as partes do contrato (proprietário + inquilino), o responsável
-- local indicado e o admin acessam. Acerto da caução é DECLARATÓRIO.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Responsável local (Fase 2): indicado pelo proprietário, sem marketplace ──
alter table public.properties
  add column if not exists responsavel_local_nome text,
  add column if not exists responsavel_local_telefone text,
  add column if not exists responsavel_local_email text,
  add column if not exists responsavel_local_user_id uuid references auth.users (id);

-- ── Estados de encerramento do contrato (estende o check existente) ──────────
alter table public.contratos drop constraint if exists contratos_status_check;
alter table public.contratos
  add constraint contratos_status_check
  check (status in ('ativo','encerrado_em_acerto','concluido','encerrado_sem_renovacao','cancelado'));

-- ── Vistorias ────────────────────────────────────────────────────────────────
create table if not exists public.vistorias (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida')),
  executor_id uuid not null references auth.users (id),   -- proprietário ou responsável local
  status text not null default 'rascunho'
    check (status in ('rascunho','aguardando_confirmacao','assinada')),
  auto_checklist boolean not null default false,          -- declaração unilateral do inquilino (Fase 3.2)
  fotos_hash text,                                        -- sha-256 do conjunto de fotos (gravado no selo)
  selada_em timestamptz,                                  -- carimbo da assinatura dos dois lados
  executor_confirmou_em timestamptz,
  inquilino_confirmou_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists vistorias_contrato_idx on public.vistorias (contrato_id);

create table if not exists public.vistoria_itens (
  id uuid primary key default gen_random_uuid(),
  vistoria_id uuid not null references public.vistorias (id) on delete cascade,
  comodo text not null,
  item text not null,
  estado text check (estado in ('otimo','bom','avaria')),         -- entrada
  marca_saida text check (marca_saida in ('conforme','dano')),    -- saída (vs entrada)
  observacao text,
  ref_item_entrada_id uuid references public.vistoria_itens (id), -- saída referencia o item da entrada
  contestacao text,                                              -- comentário do inquilino ao contestar
  created_at timestamptz not null default now()
);
create index if not exists vistoria_itens_vistoria_idx on public.vistoria_itens (vistoria_id);

create table if not exists public.vistoria_fotos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.vistoria_itens (id) on delete cascade,
  storage_path text not null,                            -- vistoria-fotos/<contrato_id>/<arquivo>
  sha256 text not null,                                  -- hash da foto (prova de integridade)
  autor_id uuid not null references auth.users (id),     -- quem enviou (executor ou inquilino na contestação)
  tirada_em timestamptz not null default now(),          -- timestamp do SERVIDOR
  created_at timestamptz not null default now()
);
create index if not exists vistoria_fotos_item_idx on public.vistoria_fotos (item_id);

-- ── Acerto da caução (declaratório) ─────────────────────────────────────────
create table if not exists public.caucao_acertos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  tipo text not null check (tipo in ('devolucao_integral','desconto')),
  caucao_total numeric(12,2) not null,
  valor_devolvido numeric(12,2),
  data_devolucao date,
  meio text,
  status text not null default 'aguardando_confirmacao'
    check (status in ('aguardando_confirmacao','devolvida_integral','desconto_confirmado','desconto_contestado')),
  registrado_por uuid not null references auth.users (id),
  confirmado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists caucao_acertos_contrato_idx on public.caucao_acertos (contrato_id);

-- REGRA 4.2: cada desconto vinculado a um item 'com dano' da vistoria de saída.
create table if not exists public.caucao_descontos (
  id uuid primary key default gen_random_uuid(),
  acerto_id uuid not null references public.caucao_acertos (id) on delete cascade,
  item_dano_id uuid not null references public.vistoria_itens (id), -- NOT NULL = sem dano, sem desconto
  valor numeric(12,2) not null check (valor > 0),
  justificativa text not null,
  foto_id uuid references public.vistoria_fotos (id),
  created_at timestamptz not null default now()
);

-- ── Helper: quem são as partes/acessos do contrato ──────────────────────────
create or replace function public.pode_ver_contrato(c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contratos c
    join public.properties p on p.id = c.property_id
    where c.id = c_id
      and (
        c.tenant_id = auth.uid()                          -- inquilino
        or p.owner_id = auth.uid()                        -- proprietário
        or p.responsavel_local_user_id = auth.uid()       -- responsável local indicado
        or public.is_admin()
      )
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.vistorias enable row level security;
alter table public.vistoria_itens enable row level security;
alter table public.vistoria_fotos enable row level security;
alter table public.caucao_acertos enable row level security;
alter table public.caucao_descontos enable row level security;

-- Leitura: só as partes do contrato (via helper). Escrita: idem, MAS nada muda
-- depois de selada (a imutabilidade é reforçada nas server actions + trigger).
drop policy if exists "vistorias: partes leem" on public.vistorias;
create policy "vistorias: partes leem" on public.vistorias for select to authenticated
  using (public.pode_ver_contrato(contrato_id));
drop policy if exists "vistorias: partes escrevem" on public.vistorias;
create policy "vistorias: partes escrevem" on public.vistorias for all to authenticated
  using (public.pode_ver_contrato(contrato_id))
  with check (public.pode_ver_contrato(contrato_id));

drop policy if exists "itens: partes" on public.vistoria_itens;
create policy "itens: partes" on public.vistoria_itens for all to authenticated
  using (exists (select 1 from public.vistorias v where v.id = vistoria_id and public.pode_ver_contrato(v.contrato_id)))
  with check (exists (select 1 from public.vistorias v where v.id = vistoria_id and public.pode_ver_contrato(v.contrato_id)));

drop policy if exists "fotos: partes" on public.vistoria_fotos;
create policy "fotos: partes" on public.vistoria_fotos for all to authenticated
  using (exists (select 1 from public.vistoria_itens i join public.vistorias v on v.id = i.vistoria_id where i.id = item_id and public.pode_ver_contrato(v.contrato_id)))
  with check (exists (select 1 from public.vistoria_itens i join public.vistorias v on v.id = i.vistoria_id where i.id = item_id and public.pode_ver_contrato(v.contrato_id)));

drop policy if exists "acertos: partes" on public.caucao_acertos;
create policy "acertos: partes" on public.caucao_acertos for all to authenticated
  using (public.pode_ver_contrato(contrato_id))
  with check (public.pode_ver_contrato(contrato_id));

drop policy if exists "descontos: partes" on public.caucao_descontos;
create policy "descontos: partes" on public.caucao_descontos for all to authenticated
  using (exists (select 1 from public.caucao_acertos a where a.id = acerto_id and public.pode_ver_contrato(a.contrato_id)))
  with check (exists (select 1 from public.caucao_acertos a where a.id = acerto_id and public.pode_ver_contrato(a.contrato_id)));

-- ── Trigger de imutabilidade: vistoria SELADA não muda mais ──────────────────
create or replace function public.trava_vistoria_selada()
returns trigger language plpgsql as $$
begin
  if old.status = 'assinada' then
    raise exception 'Vistoria assinada é imutável (prova selada).';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_trava_vistoria on public.vistorias;
create trigger trg_trava_vistoria before update on public.vistorias
  for each row when (old.status = 'assinada') execute function public.trava_vistoria_selada();

-- ── Storage privado das fotos de vistoria ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('vistoria-fotos', 'vistoria-fotos', false)
on conflict (id) do nothing;

-- Caminho: `<contrato_id>/<arquivo>`. As políticas usam a 1ª pasta (contrato_id)
-- + o helper pode_ver_contrato para restringir às partes.
drop policy if exists "vist-fotos: partes leem" on storage.objects;
create policy "vist-fotos: partes leem" on storage.objects for select to authenticated
  using (
    bucket_id = 'vistoria-fotos'
    and public.pode_ver_contrato(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "vist-fotos: partes enviam" on storage.objects;
create policy "vist-fotos: partes enviam" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vistoria-fotos'
    and public.pode_ver_contrato(((storage.foldername(name))[1])::uuid)
  );
