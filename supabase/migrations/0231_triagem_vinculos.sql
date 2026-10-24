-- 0231 — Prompt 52: triagem do morador, o comprovante de VÍNCULO (carta da residência/programa, carta do empregador ou
-- contracheque recente). Atrás da chave TRIAGEM_VINCULO_ATIVA (desligada até o parecer do item 13).
--   • bucket PRIVADO triagem-vinculos (PDF/JPG/PNG, até 10 MB) SEM política para anon/authenticated: o arquivo entra e
--     sai só pelo servidor, que devolve link assinado de 10 min ao próprio morador e ao admin (com 2FA). O dono nunca.
--   • public.triagem_vinculos: um envio por linha; status pendente → aprovado | recusado, escrito só pelo servidor.
--     Aprovado vale 12 meses (valido_ate). Um pendente por pessoa.
-- Idempotente. Rollback: supabase/producao/rollback/0231_rollback.sql.

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('triagem-vinculos', 'triagem-vinculos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists public.triagem_vinculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('carta_programa', 'carta_empregador', 'contracheque')),
  path text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'),
  hash_sha256 text not null check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  motivo text check (motivo is null or char_length(motivo) <= 400),
  decidido_por uuid references public.profiles(id) on delete set null,
  decidido_em timestamptz,
  valido_ate timestamptz,
  enviado_em timestamptz not null default now(),
  check (status <> 'aprovado' or (decidido_em is not null and valido_ate is not null)),
  check (status <> 'recusado' or motivo is not null)
);
create index if not exists triagem_vinculos_pessoa on public.triagem_vinculos (user_id, enviado_em desc);
create unique index if not exists triagem_vinculos_um_pendente on public.triagem_vinculos (user_id) where status = 'pendente';

-- Leitura e escrita só pelo servidor (service role). Nenhum grant para a sessão: nem o morador grava o status, nem o
-- dono lê a linha.
alter table public.triagem_vinculos enable row level security;
revoke all on public.triagem_vinculos from public, anon, authenticated;

comment on table public.triagem_vinculos is
  '52: comprovante de vínculo do morador (sem valores). Status só pelo servidor (admin AAL2). Aprovado vale 12 meses.';
