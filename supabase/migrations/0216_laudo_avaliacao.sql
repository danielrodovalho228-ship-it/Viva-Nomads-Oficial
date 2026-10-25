-- 0216 — Prompt 62-B2: execução da avaliação do imóvel (checklist único, laudo VIS, resultados, contestação,
-- "· vistoriado" e escada de strikes). Tudo atrás da chave VISTORIA_ATIVA (no código). Só o servidor grava (cliente de
-- serviço depois do portão de cada ação); a RLS abre a leitura a quem é parte. Os nomes vistoria_itens/vistoria_fotos
-- já são da vistoria de entrada/saída (0036): o checklist da avaliação usa vistoria_checklist*.
--
--   1. Laudo VIS no registro único (Prompt 56): prefixo 'VIS' e contador próprio.
--   2. vistoria_checklist (resposta por item, salva a cada item) e vistoria_checklist_fotos (1 por cômodo + 1 por item
--      não conforme), no bucket privado "avaliacao-imovel" (sem EXIF; sem pessoas nem pertences).
--   3. vistoria_medicoes: dB(A) e a medição de internet com prova de local (distância, sem coordenadas), SÓ internas (nenhuma leitura pública).
--   4. vistoria_laudos: uma linha por versão (resultado, nível sustentado, resumo, ressalvas, graves, prazos).
--   5. vistoria_pedidos: visita concluída, laudo atrasado, verificação (aberta pelo admin, com motivo).
--   6. proprietario_strikes (escada 1/2/3; suspenso na contestação; expira e é apagado em 12 meses).
--   7. vistoria_devolucoes ("quem perde paga": a devolver, confirmação do dono, 15 dias).
--   8. vistoria_bloqueios: anúncio fora da busca por segurança grave ou 3º strike, e republicação só com laudo
--      aprovado (2º strike). Mesmo mecanismo da 0210 (status 'paused'), sem tocar em taxa; a trava impede o dono de
--      republicar enquanto o bloqueio estiver aberto.
--   9. vistoria_fila_admin aceita os novos sinais (laudo atrasado, ressalva vencida, devolução vencida, verificação).

-- ── 1. Prefixo VIS ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.proximo_numero_documento(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prefixo text := case p_tipo
    when 'recibo_aluguel' then 'REC'
    when 'comprovante_caucao' then 'CAU'
    when 'termo_devolucao_caucao' then 'DEV'
    when 'informe_anual' then 'INF'
    when 'PRV' then 'PRV'
    when 'CND' then 'CND'
    when 'PRT' then 'PRT'
    when 'ENC' then 'ENC'
    when 'RPG' then 'RPG'
    when 'RSV' then 'RSV'
    when 'REG' then 'REG'
    when 'VIS' then 'VIS'
  end;
  a int := extract(year from now() at time zone 'America/Sao_Paulo');
  n int;
begin
  if prefixo is null then
    raise exception 'tipo de documento inválido: %', p_tipo using errcode = '22023';
  end if;
  insert into public.documentos_fiscais_contador (ano, tipo, ultimo) values (a, p_tipo, 1)
  on conflict (ano, tipo) do update set ultimo = documentos_fiscais_contador.ultimo + 1
  returning ultimo into n;
  return prefixo || '-' || a || '-' || lpad(n::text, 6, '0');
end;
$$;
revoke all on function public.proximo_numero_documento(text) from public, anon, authenticated;
grant execute on function public.proximo_numero_documento(text) to service_role;

alter table public.documentos_registro drop constraint if exists documentos_registro_prefixo_check;
alter table public.documentos_registro add constraint documentos_registro_prefixo_check check (
  prefixo in ('ORC', 'VN-CT', 'VN-SV', 'REC', 'RPG', 'RSV', 'CND', 'PRT', 'PRV', 'INF', 'ENC', 'CAU', 'DEV', 'REG', 'NFSE', 'VIS')
);

-- ── 2. Checklist e fotos ────────────────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('avaliacao-imovel', 'avaliacao-imovel', false, 10485760)
on conflict (id) do nothing;

create table if not exists public.vistoria_checklist (
  pedido_id uuid not null references public.vistoria_pedidos (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z_]{3,40}$'),
  valor text not null check (valor in ('conforme', 'nao_conforme', 'nao_se_aplica', 'pronto', 'leve', 'nao_habitavel')),
  observacao text check (observacao is null or char_length(observacao) <= 300),
  versao_checklist smallint not null default 1,
  salvo_em timestamptz not null default now(),
  primary key (pedido_id, chave)
);
alter table public.vistoria_checklist enable row level security;
revoke all on public.vistoria_checklist from public, anon, authenticated;
grant select on public.vistoria_checklist to authenticated;
grant all on public.vistoria_checklist to service_role;
drop policy if exists vistoria_checklist_le on public.vistoria_checklist;
create policy vistoria_checklist_le on public.vistoria_checklist for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.vistoria_pedidos p where p.id = vistoria_checklist.pedido_id
               and (p.owner_id = (select auth.uid()) or public.vistoria_sou_avaliador(p.avaliador_id)))
  );

create table if not exists public.vistoria_checklist_fotos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.vistoria_pedidos (id) on delete cascade,
  item_chave text check (item_chave is null or item_chave ~ '^[a-z_]{3,40}$'),
  comodo text check (comodo is null or char_length(comodo) between 2 and 40),
  path text not null check (char_length(path) between 5 and 300),
  criado_em timestamptz not null default now(),
  constraint vistoria_checklist_fotos_alvo check ((item_chave is null) <> (comodo is null))
);
create index if not exists vistoria_checklist_fotos_pedido on public.vistoria_checklist_fotos (pedido_id);
alter table public.vistoria_checklist_fotos enable row level security;
revoke all on public.vistoria_checklist_fotos from public, anon, authenticated;
grant select on public.vistoria_checklist_fotos to authenticated;
grant all on public.vistoria_checklist_fotos to service_role;
drop policy if exists vistoria_checklist_fotos_le on public.vistoria_checklist_fotos;
create policy vistoria_checklist_fotos_le on public.vistoria_checklist_fotos for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.vistoria_pedidos p where p.id = vistoria_checklist_fotos.pedido_id
               and (p.owner_id = (select auth.uid()) or public.vistoria_sou_avaliador(p.avaliador_id)))
  );

-- ── 3. Medições internas (dB(A) e internet com prova de local): só a equipe lê ──────────────────────────────────
create table if not exists public.vistoria_medicoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.vistoria_pedidos (id) on delete cascade,
  tipo text not null check (tipo in ('ruido_dba', 'internet')),
  ponto text check (ponto is null or ponto in ('quarto_principal', 'trabalho', 'sala', 'fachada')),
  dba numeric(5, 1) check (dba is null or dba between 0 and 140),
  download_mbps numeric(8, 2),
  upload_mbps numeric(8, 2),
  latencia_ms numeric(8, 2),
  -- Prova de local como no 57: só a distância até o imóvel, sem coordenadas.
  distancia_m integer check (distancia_m is null or distancia_m >= 0),
  medido_em timestamptz not null default now(),
  constraint vistoria_medicoes_campos check (
    (tipo = 'ruido_dba' and dba is not null)
    or (tipo = 'internet' and download_mbps is not null and upload_mbps is not null and ponto is not null)
  )
);
create index if not exists vistoria_medicoes_pedido on public.vistoria_medicoes (pedido_id);
alter table public.vistoria_medicoes enable row level security;
revoke all on public.vistoria_medicoes from public, anon, authenticated;
grant select on public.vistoria_medicoes to authenticated;
grant all on public.vistoria_medicoes to service_role;
drop policy if exists vistoria_medicoes_le on public.vistoria_medicoes;
create policy vistoria_medicoes_le on public.vistoria_medicoes for select to authenticated using (public.is_admin());

-- ── 4. Laudos (uma linha por versão) ────────────────────────────────────────────────────────────────────────────
create table if not exists public.vistoria_laudos (
  id uuid primary key default gen_random_uuid(),
  -- O pedido que originou o laudo (a contestação e a reverificação viram versão nova do MESMO laudo).
  pedido_id uuid not null references public.vistoria_pedidos (id) on delete cascade,
  -- O pedido desta versão (a 2ª avaliação da contestação tem o próprio pedido).
  pedido_versao_id uuid not null references public.vistoria_pedidos (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  avaliador_id uuid references public.avaliadores_credenciamento (id) on delete set null,
  versao int not null default 1 check (versao >= 1),
  documento_id uuid references public.documentos_registro (id) on delete set null,
  numero text,
  -- O PDF registrado (hash no registro VIS), guardado no bucket privado: o download não regera o documento.
  pdf_path text,
  resultado text not null check (resultado in ('aprovado', 'com_ressalvas', 'reprovado')),
  nivel_sustentado text not null check (nivel_sustentado in ('em_adequacao', 'essencial', 'conforto', 'premium')),
  versao_checklist smallint not null default 1,
  resumo jsonb not null default '[]'::jsonb,
  ressalvas jsonb not null default '[]'::jsonb,
  graves text[] not null default '{}',
  motivo_versao text check (motivo_versao is null or motivo_versao in ('correcao', 'contestacao', 'reverificacao')),
  emitido_em timestamptz not null default now(),
  prazo_ressalva_ate timestamptz,
  corrigido_em timestamptz,
  ressalva_vencida_em timestamptz,
  -- Quando o "· vistoriado" passou a valer (aprovado ou ressalva corrigida). Nulo = não vale.
  vistoriado_em timestamptz,
  contestado_em timestamptz,
  contestacao_motivo text check (contestacao_motivo is null or char_length(contestacao_motivo) between 10 and 500),
  aviso_expiracao_em timestamptz,
  expirado_em timestamptz,
  teste boolean not null default false,
  unique (pedido_id, versao)
);
create index if not exists vistoria_laudos_property on public.vistoria_laudos (property_id, emitido_em desc);
create index if not exists vistoria_laudos_owner on public.vistoria_laudos (owner_id, emitido_em desc);
alter table public.vistoria_laudos enable row level security;
revoke all on public.vistoria_laudos from public, anon, authenticated;
grant select on public.vistoria_laudos to authenticated;
grant all on public.vistoria_laudos to service_role;
drop policy if exists vistoria_laudos_le on public.vistoria_laudos;
create policy vistoria_laudos_le on public.vistoria_laudos for select to authenticated
  using (owner_id = (select auth.uid()) or public.vistoria_sou_avaliador(avaliador_id) or public.is_admin());

-- ── 5. Pedidos: visita, atraso do laudo e verificação aberta pelo admin ─────────────────────────────────────────
alter table public.vistoria_pedidos add column if not exists visita_concluida_em timestamptz;
alter table public.vistoria_pedidos add column if not exists laudo_atrasado_em timestamptz;
alter table public.vistoria_pedidos add column if not exists verificacao_motivo text;
alter table public.vistoria_pedidos add column if not exists verificacao_detalhe text;
alter table public.vistoria_pedidos add column if not exists verificacao_aberta_por uuid references auth.users (id) on delete set null;
-- As 4 perguntas de ruído respondidas na visita (vão para imovel_ruido com origem 'vistoria' quando o laudo sai).
alter table public.vistoria_pedidos add column if not exists ruido_respostas jsonb;
alter table public.vistoria_pedidos drop constraint if exists vistoria_pedidos_verificacao;
alter table public.vistoria_pedidos add constraint vistoria_pedidos_verificacao check (
  (tipo <> 'verificacao' or verificacao_motivo in ('denuncia_procedente', 'pendencia_conforto', 'ressalva_vencida', 'outro'))
  and (verificacao_detalhe is null or char_length(verificacao_detalhe) <= 500)
);

-- ── 6. Strikes do proprietário ──────────────────────────────────────────────────────────────────────────────────
create table if not exists public.proprietario_strikes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  pedido_id uuid references public.vistoria_pedidos (id) on delete set null,
  ordem smallint not null check (ordem between 1 and 3),
  origem text not null check (origem in ('verificacao_reprovada', 'ressalva_vencida')),
  criado_em timestamptz not null default now(),
  -- Contestação em curso: 'infinity' até a 2ª avaliação (não conta nem aparece); depois volta a nulo ou o strike cai.
  suspenso_ate timestamptz,
  expira_em timestamptz not null
);
create index if not exists proprietario_strikes_owner on public.proprietario_strikes (owner_id, expira_em);
create index if not exists proprietario_strikes_expira on public.proprietario_strikes (expira_em);
alter table public.proprietario_strikes enable row level security;
revoke all on public.proprietario_strikes from public, anon, authenticated;
grant select on public.proprietario_strikes to authenticated;
grant all on public.proprietario_strikes to service_role;
drop policy if exists proprietario_strikes_le on public.proprietario_strikes;
create policy proprietario_strikes_le on public.proprietario_strikes for select to authenticated
  using (public.is_admin() or (owner_id = (select auth.uid()) and suspenso_ate is null));

-- ── 7. Devoluções ("quem perde paga") ───────────────────────────────────────────────────────────────────────────
create table if not exists public.vistoria_devolucoes (
  id uuid primary key default gen_random_uuid(),
  pedido_contestacao_id uuid not null unique references public.vistoria_pedidos (id) on delete cascade,
  pedido_original_id uuid not null references public.vistoria_pedidos (id) on delete cascade,
  avaliador_id uuid references public.avaliadores_credenciamento (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  valor numeric(10, 2) not null check (valor >= 0),
  criado_em timestamptz not null default now(),
  prazo_ate timestamptz not null,
  recebido_confirmado_em timestamptz,
  fila_em timestamptz
);
alter table public.vistoria_devolucoes enable row level security;
revoke all on public.vistoria_devolucoes from public, anon, authenticated;
grant select on public.vistoria_devolucoes to authenticated;
grant all on public.vistoria_devolucoes to service_role;
drop policy if exists vistoria_devolucoes_le on public.vistoria_devolucoes;
create policy vistoria_devolucoes_le on public.vistoria_devolucoes for select to authenticated
  using (owner_id = (select auth.uid()) or public.vistoria_sou_avaliador(avaliador_id) or public.is_admin());

-- ── 8. Bloqueios (fora da busca / republicar só com laudo) ──────────────────────────────────────────────────────
create table if not exists public.vistoria_bloqueios (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (motivo in ('seguranca_grave', 'strike_2', 'strike_3')),
  pedido_id uuid references public.vistoria_pedidos (id) on delete set null,
  -- A plataforma tirou da busca (status 'paused'): ao resolver, volta para 'active'.
  pausou boolean not null default false,
  detalhe text check (detalhe is null or char_length(detalhe) <= 300),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create unique index if not exists vistoria_bloqueios_aberto on public.vistoria_bloqueios (property_id, motivo) where resolvido_em is null;
create index if not exists vistoria_bloqueios_owner on public.vistoria_bloqueios (owner_id) where resolvido_em is null;
alter table public.vistoria_bloqueios enable row level security;
revoke all on public.vistoria_bloqueios from public, anon, authenticated;
grant select on public.vistoria_bloqueios to authenticated;
grant all on public.vistoria_bloqueios to service_role;
drop policy if exists vistoria_bloqueios_le on public.vistoria_bloqueios;
create policy vistoria_bloqueios_le on public.vistoria_bloqueios for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

-- Trava da republicação (sessão de usuário): com bloqueio aberto, o dono não volta o anúncio para a busca.
create or replace function public.vistoria_bloqueio_aberto(p_property uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.vistoria_bloqueios b where b.property_id = p_property and b.resolvido_em is null)
$$;
revoke all on function public.vistoria_bloqueio_aberto(uuid) from public, anon;
grant execute on function public.vistoria_bloqueio_aberto(uuid) to authenticated, service_role;

create or replace function public.properties_exige_laudo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status::text = 'active'
     and old.status::text is distinct from 'active'
     and current_user = 'authenticated'
     and pg_trigger_depth() <= 1
     and public.vistoria_bloqueio_aberto(new.id)
  then
    raise exception 'Este anúncio volta para a busca depois de uma avaliação aprovada ou da correção comprovada.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_properties_exige_laudo on public.properties;
create trigger trg_properties_exige_laudo
  before update of status on public.properties
  for each row execute function public.properties_exige_laudo();

-- ── 9. Fila do admin ────────────────────────────────────────────────────────────────────────────────────────────
alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check check (
  tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento',
           'laudo_atrasado', 'ressalva_vencida', 'devolucao_vencida', 'seguranca_grave')
);
