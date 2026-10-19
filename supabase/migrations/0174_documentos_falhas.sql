-- Viva Nomads — 0174: fila "Documentos com falha" (complemento da jornada de assinatura, 19/10).
-- Toda emissão de recibo, comprovante ou termo que falha fica registrada com o motivo; o admin vê a fila e emite de
-- novo. Antes a falha sumia (o recibo do contrato VN-CT-11281A61 nunca saiu e ninguém viu). Só o admin lê; só o
-- servidor escreve.
create table if not exists public.documentos_falhas (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid references public.pagamentos_bloco (id) on delete cascade,
  acerto_id uuid references public.caucao_acertos (id) on delete cascade,
  motivo text not null check (char_length(motivo) between 1 and 300),
  tentativas integer not null default 1 check (tentativas >= 1),
  documento_id uuid references public.documentos_fiscais (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  constraint documentos_falhas_uma_origem check ((pagamento_id is null) <> (acerto_id is null))
);
create unique index if not exists documentos_falhas_pagamento_aberta on public.documentos_falhas (pagamento_id) where resolvido_em is null and pagamento_id is not null;
create unique index if not exists documentos_falhas_acerto_aberta on public.documentos_falhas (acerto_id) where resolvido_em is null and acerto_id is not null;
create index if not exists documentos_falhas_abertas on public.documentos_falhas (criado_em desc) where resolvido_em is null;
alter table public.documentos_falhas enable row level security;
revoke all on public.documentos_falhas from anon, authenticated;
grant select on public.documentos_falhas to authenticated;
grant all on public.documentos_falhas to service_role;
drop policy if exists documentos_falhas_admin on public.documentos_falhas;
create policy documentos_falhas_admin on public.documentos_falhas for select to authenticated using (public.is_admin());
