-- 0224 — 63-B: selo "LinkedIn conectado" e redes de pessoas PRIVADAS.
-- • confianca_linkedin: uma linha por conta conectada. Só o HASH do `sub` do LinkedIn (HMAC com o segredo do servidor),
--   a data e a validade (12 meses) e quando saiu o aviso de 30 dias. Nada mais: nem nome, nem link, nem token.
--   Um LinkedIn por conta: sub_hash único. A própria pessoa lê a sua linha; quem grava e apaga é o servidor.
--   Desconectar apaga a linha (o selo some na hora); excluir a conta apaga junto (on delete cascade).
-- • perfil_redes: Instagram/Facebook/TikTok da própria pessoa, atrás de REDES_USUARIO_ATIVO (desligada). Decisão do
--   Daniel (23/10): redes de PESSOAS nunca aparecem para outro usuário, nem depois do contrato. Só a própria pessoa
--   e a equipe (is_admin) leem.
-- • eventos: 'linkedin_conectado' e 'linkedin_desconectado', só com a data (sem usuário).
-- Idempotente.

create table if not exists public.confianca_linkedin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sub_hash text not null,
  conectado_em timestamptz not null default now(),
  valido_ate timestamptz not null,
  aviso_em timestamptz
);
create unique index if not exists confianca_linkedin_sub_hash_key on public.confianca_linkedin (sub_hash);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'confianca_linkedin_sub_hash_chk') then
    alter table public.confianca_linkedin add constraint confianca_linkedin_sub_hash_chk check (sub_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;
alter table public.confianca_linkedin enable row level security;
drop policy if exists confianca_linkedin_le on public.confianca_linkedin;
create policy confianca_linkedin_le on public.confianca_linkedin for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
revoke all on public.confianca_linkedin from anon, authenticated;
grant select on public.confianca_linkedin to authenticated;
grant select, insert, update, delete on public.confianca_linkedin to service_role;

create table if not exists public.perfil_redes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instagram text,
  facebook text,
  tiktok text,
  atualizado_em timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfil_redes_https_chk') then
    alter table public.perfil_redes add constraint perfil_redes_https_chk check (
      (instagram is null or (instagram ~ '^https://([a-z0-9-]+\.)*instagram\.com/' and length(instagram) <= 200)) and
      (facebook is null or (facebook ~ '^https://([a-z0-9-]+\.)*(facebook|fb)\.com/' and length(facebook) <= 200)) and
      (tiktok is null or (tiktok ~ '^https://([a-z0-9-]+\.)*tiktok\.com/' and length(tiktok) <= 200))
    );
  end if;
end $$;
alter table public.perfil_redes enable row level security;
drop policy if exists perfil_redes_le on public.perfil_redes;
create policy perfil_redes_le on public.perfil_redes for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists perfil_redes_grava on public.perfil_redes;
create policy perfil_redes_grava on public.perfil_redes for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists perfil_redes_muda on public.perfil_redes;
create policy perfil_redes_muda on public.perfil_redes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists perfil_redes_apaga on public.perfil_redes;
create policy perfil_redes_apaga on public.perfil_redes for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.perfil_redes from anon, authenticated;
grant select, insert, update, delete on public.perfil_redes to authenticated;
grant select, insert, update, delete on public.perfil_redes to service_role;

alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'busca', 'ver_anuncio', 'favoritar', 'iniciar_candidatura', 'enviar_candidatura',
  'iniciar_cadastro', 'concluir_cadastro', 'publicar_pedido', 'iniciar_anuncio', 'publicar_anuncio',
  'cards_generated', 'cards_shared', 'qr_scans', 'ref_listing_views', 'ref_bookings',
  'ref_partner_views', 'ref_partner_requests',
  'linkedin_conectado', 'linkedin_desconectado'
));
