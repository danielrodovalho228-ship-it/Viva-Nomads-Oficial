-- 0111 — REGISTRO DA ASSINATURA ELETRÔNICA NA PLATAFORMA (ordem 0fd301f0, F40).
-- Cada assinatura guarda quem assinou, quando, de qual IP e o HASH do resumo do contrato que a pessoa viu.
-- Só o servidor grava (service role); as duas partes do contrato leem. Uma assinatura por papel por contrato.
-- Idempotente, sem dados pessoais além do IP técnico da assinatura.

create table if not exists public.contrato_assinaturas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  papel text not null check (papel in ('proprietario', 'inquilino')),
  assinado_em timestamptz not null default now(),
  ip text,
  hash_documento text not null check (hash_documento ~ '^[0-9a-f]{64}$'),
  unique (contrato_id, papel)
);

comment on table public.contrato_assinaturas is 'Assinatura eletrônica na plataforma: quem/quando/IP/hash do resumo visto. Só o servidor grava.';

alter table public.contrato_assinaturas enable row level security;

drop policy if exists "assinatura visível às partes" on public.contrato_assinaturas;
create policy "assinatura visível às partes" on public.contrato_assinaturas
  for select using (
    exists (
      select 1 from public.contratos c
      join public.properties p on p.id = c.property_id
      where c.id = contrato_assinaturas.contrato_id
        and (c.tenant_id = auth.uid() or p.owner_id = auth.uid())
    )
  );
-- Sem policy de insert/update/delete: o navegador não escreve; a service role ignora o RLS.
revoke insert, update, delete on public.contrato_assinaturas from anon, authenticated;
