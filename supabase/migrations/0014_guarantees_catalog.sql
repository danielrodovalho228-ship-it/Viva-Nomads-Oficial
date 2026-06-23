-- ════════════════════════════════════════════════════════════════════
-- Catálogo de Garantias locatícias e Serviços adicionais (orientado a dados).
-- Mesma forma do catálogo em src/lib/guarantees.ts — ligar um parceiro depois é
-- só inserir/atualizar um registro e mudar o status, sem reescrever o fluxo.
-- Leitura pública (catálogo); escrita restrita ao backend/admin.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.garantias (
  id text primary key,
  nome text not null,
  tipo text not null check (tipo in ('caucao', 'titulo', 'garantidor_digital')),
  prazo_min_dias int not null,
  prazo_max_dias int not null,
  quem_paga text not null check (quem_paga in ('inquilino', 'proprietario')),
  reembolsavel boolean not null default false,
  status text not null check (status in ('ativo', 'em_breve', 'inativo')),
  parceiro_nome text,
  observacao text
);

create table if not exists public.servicos_adicionais (
  id text primary key,
  nome text not null,
  categoria text not null check (categoria in ('assistencia_inquilino', 'manutencao_proprietario')),
  quem_paga text not null check (quem_paga in ('inquilino', 'proprietario')),
  parceiro_nome text,
  status text not null check (status in ('ativo', 'em_breve', 'inativo')),
  descricao text not null
);

-- Seed inicial (idempotente).
insert into public.garantias (id, nome, tipo, prazo_min_dias, prazo_max_dias, quem_paga, reembolsavel, status, parceiro_nome, observacao)
values
  ('caucao', 'Caução', 'caucao', 1, 180, 'inquilino', true, 'ativo', null,
   'Depósito em conta vinculada (locador + locatário), devolvido ao fim. A plataforma registra; nunca recebe nem retém o valor.'),
  ('titulo', 'Título de capitalização', 'titulo', 1, 180, 'inquilino', true, 'ativo', null,
   'Resgatável ao fim do contrato. A plataforma documenta o número do título.'),
  ('garantidor_digital', 'Garantidor digital', 'garantidor_digital', 90, 180, 'inquilino', false, 'em_breve', null, null)
on conflict (id) do nothing;

insert into public.servicos_adicionais (id, nome, categoria, quem_paga, parceiro_nome, status, descricao)
values
  ('assistencia_24h', 'Assistência 24h', 'assistencia_inquilino', 'inquilino', null, 'em_breve',
   'Chaveiro, encanador, elétrica e mais. A plataforma intermedeia e roteia o pagamento ao prestador; não executa o serviço.'),
  ('plano_manutencao', 'Plano de manutenção', 'manutencao_proprietario', 'proprietario', null, 'em_breve',
   'Manutenção preventiva e corretiva do imóvel. A plataforma intermedeia e roteia o pagamento ao prestador; não executa o serviço.')
on conflict (id) do nothing;

-- RLS: catálogo é público para leitura; escrita só admin/backend.
alter table public.garantias enable row level security;
alter table public.servicos_adicionais enable row level security;

drop policy if exists "catálogo de garantias é público" on public.garantias;
create policy "catálogo de garantias é público" on public.garantias
  for select using (true);

drop policy if exists "catálogo de serviços é público" on public.servicos_adicionais;
create policy "catálogo de serviços é público" on public.servicos_adicionais
  for select using (true);
