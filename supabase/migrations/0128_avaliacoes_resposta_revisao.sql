-- 0128 — AVALIAÇÕES: RESPOSTA PÚBLICA do avaliado e PEDIDO DE REVISÃO (ordem 404cd213, item 4).
--
-- • Resposta: só o AVALIADO, a uma avaliação PUBLICADA, uma vez, até 500 caracteres,
--   sem contato nem ofensa (o banco recusa). Aparece junto da avaliação, para todos. Imutável.
-- • Pedido de revisão: só o avaliado, de avaliação publicada, com motivo OBJETIVO
--   (ofensa, dado pessoal, fato falso) + explicação. Uma pendente por avaliação. Vai para a fila do admin;
--   quem decide é o admin (service_role no servidor). A avaliação só sai do ar por essa regra objetiva.
-- Rollback: supabase/producao/rollback/0128_rollback.sql

create table if not exists public.avaliacao_respostas (
  avaliacao_id uuid primary key references public.avaliacoes(id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 500),
  criada_em timestamptz not null default now()
);

create table if not exists public.avaliacao_contestacoes (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes(id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  motivo text not null check (motivo in ('ofensa', 'dado_pessoal', 'fato_falso')),
  detalhe text not null check (char_length(btrim(detalhe)) between 20 and 500),
  status text not null default 'aberta' check (status in ('aberta', 'mantida', 'removida')),
  decisao text check (decisao is null or char_length(decisao) <= 500),
  criada_em timestamptz not null default now(),
  decidida_em timestamptz
);
create unique index if not exists avaliacao_contestacoes_uma_aberta
  on public.avaliacao_contestacoes (avaliacao_id) where status = 'aberta';
create index if not exists avaliacao_contestacoes_fila on public.avaliacao_contestacoes (status, criada_em);

-- Só o avaliado, só avaliação publicada; sem contato nem ofensa.
create or replace function public.avaliacao_resposta_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare a record;
begin
  select alvo_id, status into a from public.avaliacoes where id = new.avaliacao_id;
  if not found or a.status <> 'publicada' then
    raise exception 'Só é possível responder a uma avaliação publicada.' using errcode = '23514';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    new.autor_id := auth.uid();
    if a.alvo_id is distinct from auth.uid() then
      raise exception 'Só a pessoa avaliada responde.' using errcode = '42501';
    end if;
  end if;
  if public.contem_contato(new.texto, true) then
    raise exception 'Tire telefone, e-mail ou rede social da resposta.' using errcode = '23514';
  end if;
  if public.contem_ofensa(new.texto) then
    raise exception 'A resposta não pode ter ofensa.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists avaliacao_resposta_valida on public.avaliacao_respostas;
create trigger avaliacao_resposta_valida before insert on public.avaliacao_respostas
  for each row execute function public.avaliacao_resposta_valida();

create or replace function public.avaliacao_contestacao_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare a record;
begin
  if tg_op = 'INSERT' then
    select alvo_id, status into a from public.avaliacoes where id = new.avaliacao_id;
    if not found or a.status <> 'publicada' then
      raise exception 'Só é possível pedir revisão de uma avaliação publicada.' using errcode = '23514';
    end if;
    if coalesce(auth.role(), '') <> 'service_role' then
      new.autor_id := auth.uid();
      if a.alvo_id is distinct from auth.uid() then
        raise exception 'Só a pessoa avaliada pede revisão.' using errcode = '42501';
      end if;
      new.status := 'aberta';
      new.decisao := null;
      new.decidida_em := null;
    end if;
  elsif coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Só a equipe decide o pedido de revisão.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists avaliacao_contestacao_valida on public.avaliacao_contestacoes;
create trigger avaliacao_contestacao_valida before insert or update on public.avaliacao_contestacoes
  for each row execute function public.avaliacao_contestacao_valida();

alter table public.avaliacao_respostas enable row level security;
alter table public.avaliacao_contestacoes enable row level security;
revoke all on public.avaliacao_respostas, public.avaliacao_contestacoes from anon, authenticated;
grant select on public.avaliacao_respostas to anon, authenticated;
grant insert (avaliacao_id, texto) on public.avaliacao_respostas to authenticated;
grant insert (avaliacao_id, motivo, detalhe) on public.avaliacao_contestacoes to authenticated;
grant select on public.avaliacao_contestacoes to authenticated;
grant all on public.avaliacao_respostas, public.avaliacao_contestacoes to service_role;

drop policy if exists avaliacao_respostas_publicas on public.avaliacao_respostas;
create policy avaliacao_respostas_publicas on public.avaliacao_respostas for select to anon, authenticated
  using (exists (select 1 from public.avaliacoes a where a.id = avaliacao_id and a.status = 'publicada'));
drop policy if exists avaliacao_respostas_avaliado_cria on public.avaliacao_respostas;
create policy avaliacao_respostas_avaliado_cria on public.avaliacao_respostas for insert to authenticated
  with check (autor_id = auth.uid());
drop policy if exists avaliacao_contestacoes_le on public.avaliacao_contestacoes;
create policy avaliacao_contestacoes_le on public.avaliacao_contestacoes for select to authenticated
  using (autor_id = auth.uid() or public.is_admin());
drop policy if exists avaliacao_contestacoes_cria on public.avaliacao_contestacoes;
create policy avaliacao_contestacoes_cria on public.avaliacao_contestacoes for insert to authenticated
  with check (autor_id = auth.uid());

revoke all on function public.avaliacao_resposta_valida() from public, anon, authenticated;
revoke all on function public.avaliacao_contestacao_valida() from public, anon, authenticated;
