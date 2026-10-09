-- 0095 — APROVAÇÕES PELO CHAT DO MOACIR (ordem 41ae4fc5, parte 1). APLICADA PELO MERGE.
--   • public.aprovacoes: pedidos que esperam o OK do Daniel (merge de PR, migração, decisão, documento).
--   • RLS: só admin lê e decide; o pedido (insert) só nasce no servidor (service_role).
--   • Imutável: decisão só sai de 'pendente' uma vez; linha decidida não muda e não se apaga.
--   • Sem dado pessoal: 'resumo' e 'referencia' são texto curto de trabalho (ex.: "PR #341").
-- Só cria coisas novas e é idempotente. Sem DROP.

do $$
begin
  if to_regclass('public.aprovacoes') is null then
    create table public.aprovacoes (
      id uuid primary key default gen_random_uuid(),
      tipo text not null check (tipo in ('merge_pr', 'migracao', 'decisao', 'documento')),
      referencia text not null check (char_length(referencia) between 1 and 120),
      resumo text not null check (char_length(resumo) between 1 and 600),
      risco text not null default 'medio' check (risco in ('baixo', 'medio', 'alto')),
      pedido_por text not null check (char_length(pedido_por) between 1 and 40),
      status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'expirada')),
      hash_conteudo text check (hash_conteudo is null or hash_conteudo ~ '^[0-9a-f]{7,64}$'),
      decidido_por uuid references auth.users(id) on delete set null,
      decidido_em timestamptz,
      criado_em timestamptz not null default now(),
      expira_em timestamptz not null default now() + interval '72 hours',
      check ((status = 'pendente') = (decidido_em is null) or status = 'expirada')
    );
    create index aprovacoes_pendentes on public.aprovacoes (criado_em desc) where status = 'pendente';
    create index aprovacoes_referencia on public.aprovacoes (tipo, referencia, criado_em desc);
  end if;
end;
$$;

alter table public.aprovacoes enable row level security;
revoke all on public.aprovacoes from public, anon, authenticated;
grant select on public.aprovacoes to authenticated;
grant all on public.aprovacoes to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'aprovacoes' and policyname = 'aprovacoes: admin le') then
    create policy "aprovacoes: admin le" on public.aprovacoes
      for select to authenticated using (public.is_admin());
  end if;
end;
$$;

-- Trava de imutabilidade: depois de decidida, a linha não muda (log imutável) e não se apaga.
create or replace function public.aprovacoes_imutavel()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'aprovacoes é um registro imutável';
  end if;
  if old.status <> 'pendente' then
    raise exception 'aprovação já decidida não pode mudar';
  end if;
  return new;
end;
$fn$;

revoke all on function public.aprovacoes_imutavel() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'aprovacoes_imutavel' and tgrelid = 'public.aprovacoes'::regclass) then
    create trigger aprovacoes_imutavel
      before update or delete on public.aprovacoes
      for each row execute function public.aprovacoes_imutavel();
  end if;
end;
$$;
