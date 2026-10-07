-- Rollback da 0089: volta as 3 tabelas como estavam em 07/10/2026 (VAZIAS) e o cartão da Fernanda.
-- ATENÇÃO: apaga as avaliações gravadas no formato novo. Só rode se ainda não houver avaliação real.
begin;
set local lock_timeout = '5s';
do $$
begin
  if exists (select 1 from public.avaliacoes) then
    raise exception 'avaliacoes tem linhas: rollback interrompido para não perder avaliações reais';
  end if;
end;
$$;
drop table public.avaliacoes;
drop function public.avaliacao_apos_envio();
drop function public.publicar_avaliacoes(uuid);
drop function public.avaliacoes_recebidas();
drop function public.pode_avaliar(uuid, uuid);
drop function public.contem_ofensa(text);

-- reviews (0004) — leitura pública; INSERT do autor; sem escrita para anon (0083)
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  target_role text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy "avaliações públicas" on public.reviews for select using (true);
create policy "autor cria avaliação" on public.reviews for insert with check (author_id = auth.uid());
revoke insert, update, delete on public.reviews from anon;

-- property_reviews (0018 + 0062: só leitura)
create table public.property_reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  author_name text not null,
  rating numeric(2, 1) not null check (rating between 0 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index property_reviews_idx on public.property_reviews (property_id, created_at desc);
alter table public.property_reviews enable row level security;
create policy "avaliações de imóvel públicas" on public.property_reviews for select using (
  exists (select 1 from public.properties p where p.id = property_reviews.property_id and (p.status = 'active' or p.owner_id = auth.uid()))
);
revoke insert, update, delete on public.property_reviews from anon, authenticated;

-- avaliacoes (0034 + 0057 contato + 0062 validação; escrita só pelo servidor)
create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references public.contratos(id) on delete set null,
  autor_id uuid not null references auth.users(id) on delete cascade,
  alvo_id uuid not null references auth.users(id) on delete cascade,
  papel_autor text not null check (papel_autor in ('proprietario', 'inquilino')),
  rating int not null check (rating between 1 and 5),
  comentario text,
  created_at timestamptz not null default now(),
  unique (contrato_id, autor_id)
);
create index avaliacoes_alvo_idx on public.avaliacoes (alvo_id);
create index avaliacoes_contrato_idx on public.avaliacoes (contrato_id);
alter table public.avaliacoes enable row level security;
create policy "avaliações públicas" on public.avaliacoes for select using (true);
revoke insert, update, delete on public.avaliacoes from anon, authenticated;
create or replace function public.avaliacao_valida()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if new.contrato_id is null then raise exception 'Avaliação precisa de um contrato.' using errcode = '23514'; end if;
  if new.autor_id = new.alvo_id then raise exception 'Ninguém avalia a si mesmo.' using errcode = '23514'; end if;
  select ct.status, ct.tenant_id, pr.owner_id into c
    from public.contratos ct join public.properties pr on pr.id = ct.property_id where ct.id = new.contrato_id;
  if not found then raise exception 'Contrato não encontrado.' using errcode = '23514'; end if;
  if c.status not in ('concluido', 'encerrado_sem_renovacao', 'encerrado_em_acerto') then
    raise exception 'Só é possível avaliar depois do fim do contrato.' using errcode = '23514';
  end if;
  if not ((new.autor_id = c.tenant_id and new.alvo_id = c.owner_id) or (new.autor_id = c.owner_id and new.alvo_id = c.tenant_id)) then
    raise exception 'Autor e avaliado precisam ser as partes do contrato.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger trg_avaliacao_valida before insert or update on public.avaliacoes
  for each row execute function public.avaliacao_valida();
create trigger contato_avaliacao_comentario before insert or update of comentario on public.avaliacoes
  for each row execute function public.bloqueia_contato_texto('comentario', 'rigoroso');

update public.agentes set cargo = 'Antifraude', briefing = 'Antifraude de cadastros e pagamentos.' where slug = 'fernanda';
delete from supabase_migrations.schema_migrations where version = '20261007000089';
commit;
