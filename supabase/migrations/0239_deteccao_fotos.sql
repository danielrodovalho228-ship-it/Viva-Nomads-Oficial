-- DETECTA-B — o que as fotos da galeria mostram (itens de Conforto/Premium e comodidades dos filtros) como SUGESTÃO.
-- • deteccao_fotos_analises: cada foto analisada uma vez (cache por anúncio + hash dos bytes; o caminho também, para
--   nem baixar de novo). Guarda se havia pessoa e se a resposta do modelo era válida. Sem dado de pessoa.
-- • deteccao_sugestoes: anúncio, foto, chave, confiança e status 'sugerida' | 'aceita' | 'descartada'. Sugestão NUNCA
--   conta para o nível nem marca comodidade: confirmar segue o caminho de hoje (salvarItemNivel / salvar do anúncio).
-- • Só o servidor grava (service role); o dono lê as do próprio anúncio. Saem em cascata com o anúncio.
-- • ia_chamadas.rota ganha 'deteccao' (registro técnico, sem dado pessoal).

create table if not exists public.deteccao_fotos_analises (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  caminho text not null check (char_length(caminho) between 10 and 200),
  foto_hash text not null check (foto_hash ~ '^[0-9a-f]{64}$'),
  pessoa boolean not null default false,
  valida boolean not null default true,
  modelo text check (modelo is null or char_length(modelo) <= 60),
  analisada_em timestamptz not null default now()
);
create unique index if not exists deteccao_fotos_analises_caminho_uidx on public.deteccao_fotos_analises (property_id, caminho);
create index if not exists deteccao_fotos_analises_hash_idx on public.deteccao_fotos_analises (property_id, foto_hash);
create index if not exists deteccao_fotos_analises_dia_idx on public.deteccao_fotos_analises (analisada_em desc);
alter table public.deteccao_fotos_analises enable row level security;
comment on table public.deteccao_fotos_analises is
  'DETECTA-B: fotos da galeria já analisadas (cache por anúncio + hash). Só o servidor lê e grava; contador do admin.';

create table if not exists public.deteccao_sugestoes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  caminho text not null check (char_length(caminho) between 10 and 200),
  foto_hash text not null check (foto_hash ~ '^[0-9a-f]{64}$'),
  chave text not null check (char_length(chave) between 2 and 60),
  tipo text not null check (tipo in ('nivel', 'comodidade')),
  confianca numeric(3,2) not null check (confianca >= 0 and confianca <= 1),
  status text not null default 'sugerida' check (status in ('sugerida', 'aceita', 'descartada')),
  motivo text check (motivo is null or motivo in ('pessoa', 'dono')),
  criada_em timestamptz not null default now(),
  decidida_em timestamptz,
  check (status <> 'descartada' or motivo is not null),
  check (status = 'sugerida' or decidida_em is not null or coalesce(motivo, '') = 'pessoa')
);
create unique index if not exists deteccao_sugestoes_uidx on public.deteccao_sugestoes (property_id, foto_hash, chave);
create index if not exists deteccao_sugestoes_imovel_idx on public.deteccao_sugestoes (property_id, status);
alter table public.deteccao_sugestoes enable row level security;
drop policy if exists "dono lê as sugestões do anúncio" on public.deteccao_sugestoes;
create policy "dono lê as sugestões do anúncio" on public.deteccao_sugestoes for select to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
);
grant select on public.deteccao_sugestoes to authenticated;
comment on table public.deteccao_sugestoes is
  'DETECTA-B: sugestão de item/comodidade achado na foto. Nunca conta para o nível; confirmar usa salvarItemNivel.';

alter table public.ia_chamadas drop constraint if exists ia_chamadas_rota_check;
alter table public.ia_chamadas add constraint ia_chamadas_rota_check check (rota in ('fotos', 'documento', 'matricula', 'deteccao'));
