-- 0242 — FOTO-NA-HORA-B (decisão do Daniel, 24/10): a foto que PROVA um item de nível (Conforto/Premium) é feita na
-- hora, pela câmera. As fotos do anúncio (galeria) continuam aceitando envio da galeria.
-- • nivel_itens: origem da foto ('camera' | 'arquivo'), hora da captura, hash perceptual (16 hex, mesma regra de
--   fotos_anuncio_hash) e o prazo para refazer a prova antiga. As provas que já existem viram 'arquivo' com prazo de
--   30 dias a contar da aplicação desta migração (publicação da regra); vencido sem foto nova, o item deixa de contar.
-- • prova_capturas: o token de captura que o servidor emite ao abrir a câmera (anúncio, item, dono; 10 minutos; uso
--   único). Só o hash do token fica guardado. A foto da prova só é aceita com token válido e não usado.
-- • prova_links_celular: o link "Continuar no celular" (30 minutos, uso único, ligado ao dono). Só o hash do token.
-- • deteccao_sugestoes: novo status 'confirmada_sem_foto' (o dono confirmou a sugestão, falta a foto da câmera; não
--   conta para o nível).
-- As duas tabelas novas são só do servidor (service_role); nenhuma política para anon/authenticated.

alter table public.nivel_itens
  add column if not exists foto_origem text check (foto_origem is null or foto_origem in ('camera', 'arquivo')),
  add column if not exists foto_capturada_em timestamptz,
  add column if not exists foto_hash text check (foto_hash is null or foto_hash ~ '^[0-9a-f]{16}$'),
  add column if not exists refazer_ate timestamptz,
  add column if not exists vencida_avisada_em timestamptz;

update public.nivel_itens
   set foto_origem = 'arquivo', refazer_ate = now() + interval '30 days'
 where foto_path is not null and foto_origem is null;

alter table public.nivel_itens drop constraint if exists nivel_itens_foto_com_origem;
alter table public.nivel_itens add constraint nivel_itens_foto_com_origem check (foto_path is null or foto_origem is not null);
alter table public.nivel_itens drop constraint if exists nivel_itens_camera_sem_prazo;
alter table public.nivel_itens add constraint nivel_itens_camera_sem_prazo check (foto_origem is distinct from 'camera' or (refazer_ate is null and foto_capturada_em is not null));
create index if not exists nivel_itens_foto_hash_idx on public.nivel_itens (foto_hash) where foto_hash is not null;
create index if not exists nivel_itens_refazer_idx on public.nivel_itens (refazer_ate) where foto_origem = 'arquivo';

create table if not exists public.prova_capturas (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z_]{3,40}$'),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  foto_path text check (foto_path is null or foto_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  foto_hash text check (foto_hash is null or foto_hash ~ '^[0-9a-f]{16}$'),
  capturada_em timestamptz,
  usado_em timestamptz,
  check (expira_em > criado_em),
  check ((foto_path is null) = (capturada_em is null)),
  check (usado_em is null or foto_path is not null)
);
create index if not exists prova_capturas_dono_idx on public.prova_capturas (owner_id, criado_em desc);
create index if not exists prova_capturas_hash_idx on public.prova_capturas (foto_hash) where foto_hash is not null;
alter table public.prova_capturas enable row level security;
revoke all on public.prova_capturas from public, anon, authenticated;
grant all on public.prova_capturas to service_role;
comment on table public.prova_capturas is
  'FOTO-NA-HORA-B: token de captura da câmera (hash), anúncio, item, dono, validade de 10 min e uso único; a foto tirada com ele (caminho, hash perceptual, hora).';

create table if not exists public.prova_links_celular (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z_]{3,40}$'),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  check (expira_em > criado_em)
);
create index if not exists prova_links_celular_dono_idx on public.prova_links_celular (owner_id, criado_em desc);
alter table public.prova_links_celular enable row level security;
revoke all on public.prova_links_celular from public, anon, authenticated;
grant all on public.prova_links_celular to service_role;
comment on table public.prova_links_celular is
  'FOTO-NA-HORA-B: link "Continuar no celular" (hash do token), dono, anúncio e item; 30 min, uso único; nunca entra como outra conta.';

alter table public.deteccao_sugestoes drop constraint if exists deteccao_sugestoes_status_check;
alter table public.deteccao_sugestoes add constraint deteccao_sugestoes_status_check
  check (status in ('sugerida', 'aceita', 'descartada', 'confirmada_sem_foto'));
