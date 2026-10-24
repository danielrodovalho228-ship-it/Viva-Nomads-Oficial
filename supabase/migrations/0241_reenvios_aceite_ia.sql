-- Viva Nomads — 0241 (L2-B itens 14 e 23).
-- Item 14: registro de cada "Reenviar e-mail" de um documento emitido, feito pelo admin na aba "Emitidos" de
--   /admin/documentos. O reenvio manda o MESMO documento (mesmo número, mesmo código de conferência, o PDF guardado):
--   nada é reemitido. O resultado guarda só papel e status por destinatário, nunca o endereço. Só o servidor lê e grava.
-- Item 23: aceite do termo de IA POR DONO (data e versão do termo). O cadastro e o editor leem daqui ao abrir: quem já
--   aceitou a versão atual não vê a caixa de novo até a versão mudar. O aceite por anúncio (anuncio_aceites_ia, 0103) e
--   o portão do publicar (0203) continuam como estão.
-- Idempotente. Sem comandos que gerem NOTICE. Rollback: supabase/producao/rollback/0241_rollback.sql.

create table if not exists public.documentos_reenvios (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.documentos_registro (id) on delete cascade,
  documento_id uuid references public.documentos_fiscais (id) on delete set null,
  numero text not null check (char_length(numero) between 3 and 60),
  admin_id uuid references auth.users (id) on delete set null,
  resultado jsonb not null default '[]'::jsonb check (jsonb_typeof(resultado) = 'array'),
  criado_em timestamptz not null default now()
);
create index if not exists documentos_reenvios_registro_idx on public.documentos_reenvios (registro_id, criado_em desc);
alter table public.documentos_reenvios enable row level security;
revoke all on public.documentos_reenvios from public, anon, authenticated;
grant all on public.documentos_reenvios to service_role;
comment on table public.documentos_reenvios is
  'L2-B item 14: reenvio do e-mail de um documento emitido (mesmo número). resultado = [{papel, status, em}], sem endereço.';

create table if not exists public.termo_ia_aceites (
  user_id uuid not null references auth.users (id) on delete cascade,
  versao text not null check (char_length(versao) between 4 and 20),
  aceito_em timestamptz not null default now(),
  primary key (user_id, versao)
);
alter table public.termo_ia_aceites enable row level security;
drop policy if exists "termo ia: a própria pessoa lê" on public.termo_ia_aceites;
create policy "termo ia: a própria pessoa lê" on public.termo_ia_aceites for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "termo ia: a própria pessoa aceita" on public.termo_ia_aceites;
create policy "termo ia: a própria pessoa aceita" on public.termo_ia_aceites for insert to authenticated
  with check (user_id = auth.uid());
revoke all on public.termo_ia_aceites from public, anon, authenticated;
grant select, insert on public.termo_ia_aceites to authenticated;
grant all on public.termo_ia_aceites to service_role;
comment on table public.termo_ia_aceites is
  'L2-B item 23: aceite do termo de IA por dono e versão. Quem aceitou a versão atual não vê a caixa de novo.';
