-- 0163 — Prompt 22 (18/10): registro das chamadas de IA do cadastro (fotos, documento, matrícula), SEM dado pessoal:
-- rota, deu certo ou não, status HTTP, tipo do erro, motivo para a tela, modelo, tipo e tamanho do arquivo, se foi
-- reduzido e a duração. Nada de user_id, CPF, nome, endereço ou conteúdo. Alimenta o painel "IA do cadastro" do
-- /admin. RLS: só o admin lê; quem grava é o servidor (cliente de serviço). Idempotente.
create table if not exists public.ia_chamadas (
  id uuid primary key default gen_random_uuid(),
  rota text not null check (rota in ('fotos', 'documento', 'matricula')),
  ok boolean not null,
  status integer check (status is null or status between 0 and 999),
  tipo_erro text check (tipo_erro is null or char_length(tipo_erro) <= 60),
  motivo text check (motivo is null or motivo in ('desligada', 'limite', 'arquivo_grande', 'ilegivel', 'indisponivel')),
  modelo text check (modelo is null or char_length(modelo) <= 60),
  arquivo_mime text check (arquivo_mime is null or char_length(arquivo_mime) <= 40),
  arquivo_bytes integer check (arquivo_bytes is null or arquivo_bytes >= 0),
  reduzido boolean not null default false,
  duracao_ms integer check (duracao_ms is null or duracao_ms >= 0),
  criada_em timestamptz not null default now()
);
create index if not exists ia_chamadas_rota_idx on public.ia_chamadas (rota, criada_em desc);

alter table public.ia_chamadas enable row level security;
revoke all on public.ia_chamadas from public, anon, authenticated;
grant select on public.ia_chamadas to authenticated;
grant all on public.ia_chamadas to service_role;

drop policy if exists ia_chamadas_admin_le on public.ia_chamadas;
create policy ia_chamadas_admin_le on public.ia_chamadas for select to authenticated
  using (public.is_admin());
