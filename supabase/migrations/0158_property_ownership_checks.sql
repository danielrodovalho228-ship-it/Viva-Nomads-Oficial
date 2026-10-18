-- Prompt 19: conferência do DONO pela matrícula, cruzada com a CAF (identidade).
-- Uma linha por matrícula enviada: o que foi lido (sem CPF inteiro — de outros proprietários só os 3 últimos
-- dígitos e o resultado da comparação), os ônus em aberto, se a CAF estava ok e o resultado
-- (conferido | provavel | em_revisao | recusado). Nada disso vai para página ou API pública.
-- RLS: só o dono (leitura) e o admin. Gravação só pelo servidor (cliente de serviço).
create table if not exists public.property_ownership_checks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  arquivo_path text not null check (char_length(arquivo_path) <= 200),
  matricula_numero text check (matricula_numero is null or char_length(matricula_numero) <= 30),
  cartorio text check (cartorio is null or char_length(cartorio) <= 150),
  resultado text not null check (resultado in ('conferido', 'provavel', 'em_revisao', 'recusado')),
  motivo text check (motivo is null or char_length(motivo) <= 60),
  campos_extraidos jsonb not null default '{}'::jsonb,
  onus jsonb not null default '[]'::jsonb,
  caf_ok boolean not null default false,
  caf_simulado boolean not null default false,
  caso text check (caso is null or caso in ('conjuge', 'heranca', 'empresa', 'gestor', 'compra_nao_registrada')),
  caso_documento_path text check (caso_documento_path is null or char_length(caso_documento_path) <= 200),
  criada_em timestamptz not null default now(),
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_em timestamptz,
  revisao_motivo text check (revisao_motivo is null or char_length(revisao_motivo) <= 500)
);

create index if not exists ownership_checks_property_idx on public.property_ownership_checks (property_id, criada_em desc);
create index if not exists ownership_checks_user_idx on public.property_ownership_checks (user_id, criada_em desc);
create index if not exists ownership_checks_fila_idx on public.property_ownership_checks (resultado, criada_em) where revisado_em is null;
create index if not exists ownership_checks_revisado_por_idx on public.property_ownership_checks (revisado_por);

alter table public.property_ownership_checks enable row level security;
revoke all on public.property_ownership_checks from anon;
revoke all on public.property_ownership_checks from authenticated;
-- O dono só LÊ as próprias conferências; quem grava é o servidor (cliente de serviço), depois de ler o arquivo.
grant select on public.property_ownership_checks to authenticated;

drop policy if exists ownership_checks_dono_ou_admin_le on public.property_ownership_checks;
create policy ownership_checks_dono_ou_admin_le on public.property_ownership_checks
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
