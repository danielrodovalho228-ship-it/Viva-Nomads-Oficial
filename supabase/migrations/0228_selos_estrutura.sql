-- 0228 — Selos de estrutura (ordem 512f3ed0, parte 2): onde o dono grava o checklist de Acessível e de Mobilidade
-- reduzida / idosos. O selo só aparece com TODOS os itens marcados (src/lib/selos-estrutura.ts). Sem dado pessoal.
-- Só o servidor grava (depois de conferir o dono); leitura pública só do anúncio ativo; dono e equipe leem o próprio.
-- Reaplicar é seguro.
create table if not exists public.imovel_estrutura (
  property_id uuid primary key references public.properties (id) on delete cascade,
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  atualizado_em timestamptz not null default now()
);
alter table public.imovel_estrutura enable row level security;
revoke all on public.imovel_estrutura from anon, authenticated;
grant select on public.imovel_estrutura to anon, authenticated;
grant all on public.imovel_estrutura to service_role;
drop policy if exists "estrutura: anuncio ativo" on public.imovel_estrutura;
create policy "estrutura: anuncio ativo" on public.imovel_estrutura for select to anon using (
  exists (select 1 from public.properties p where p.id = imovel_estrutura.property_id and p.status::text = 'active')
);
drop policy if exists "estrutura: anuncio ativo, dono e equipe (logado)" on public.imovel_estrutura;
create policy "estrutura: anuncio ativo, dono e equipe (logado)" on public.imovel_estrutura for select to authenticated using (
  public.is_admin() or exists (select 1 from public.properties p where p.id = imovel_estrutura.property_id and (p.status::text = 'active' or p.owner_id = auth.uid()))
);
