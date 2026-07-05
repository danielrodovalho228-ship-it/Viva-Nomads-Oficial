-- Avaliação BIDIRECIONAL (proprietário ↔ inquilino) após a estadia, atrelada ao
-- contrato. Constrói reputação das PESSOAS (as avaliações do IMÓVEL continuam em
-- property_reviews). Cada parte avalia a outra UMA vez por contrato.

create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos(id) on delete set null,
  autor_id uuid not null references auth.users(id) on delete cascade,
  alvo_id uuid not null references auth.users(id) on delete cascade,
  papel_autor text not null check (papel_autor in ('proprietario', 'inquilino')),
  rating int not null check (rating between 1 and 5),
  comentario text,
  created_at timestamptz not null default now(),
  unique (contrato_id, autor_id)
);

create index if not exists avaliacoes_alvo_idx on avaliacoes (alvo_id);
create index if not exists avaliacoes_contrato_idx on avaliacoes (contrato_id);

alter table avaliacoes enable row level security;

-- Leitura pública: a nota/comentário formam a reputação exibida no anúncio e no
-- perfil. Não expõe dado sensível além do texto que o autor escreveu.
drop policy if exists "avaliações públicas" on avaliacoes;
create policy "avaliações públicas" on avaliacoes for select using (true);

-- Só o AUTOR cria a sua avaliação (autor_id = ele). A unicidade por contrato
-- impede duplicar. (Sem update/delete: avaliação é registro histórico.)
drop policy if exists "autor cria avaliação" on avaliacoes;
create policy "autor cria avaliação" on avaliacoes for insert
  with check (autor_id = auth.uid());
