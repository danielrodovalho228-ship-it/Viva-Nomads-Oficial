-- ─────────────────────────────────────────────────────────────
-- Faixas de prazo (temporada / média estadia / longa), garantias realinhadas
-- e tabela de modelos de contrato (texto plugável, sem código). Idempotente.
-- prazo_min/max reusam min_period_days / max_period_days (já existentes).
-- ─────────────────────────────────────────────────────────────

-- Enum da faixa (usado em modelos_contrato; faixas_aceitas fica como text[]).
do $$ begin
  create type faixa_prazo as enum ('temporada','media_estadia','longa');
exception when duplicate_object then null; end $$;

-- Faixas aceitas pelo imóvel (subconjunto do enum, como array de texto).
alter table properties add column if not exists faixas_aceitas text[] not null default '{}';

-- ── Garantias: realinha para caucao_avista / caucao_parcelada / titulo / seguro_fianca ──
-- 'caucao' antigo → 'caucao_avista'; e dobra accepts_insurance=true em 'seguro_fianca'.
update properties
   set garantias_aceitas = (
     select array(
       select distinct case when g = 'caucao' then 'caucao_avista' else g end
       from unnest(coalesce(garantias_aceitas, '{}')) as g
       where g <> 'garantidor_digital'
     )
   )
 where garantias_aceitas is not null;

update properties
   set garantias_aceitas = array_append(coalesce(garantias_aceitas, '{}'), 'seguro_fianca')
 where coalesce(accepts_insurance, false) = true
   and not ('seguro_fianca' = any(coalesce(garantias_aceitas, '{}')));

-- ── Modelos de contrato por faixa (texto vem depois — começa vazio) ──
create table if not exists modelos_contrato (
  id uuid primary key default gen_random_uuid(),
  faixa faixa_prazo not null,
  titulo text not null,
  conteudo text,                         -- markdown; placeholder até a validação jurídica
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists modelos_contrato_faixa_idx on modelos_contrato (faixa, ativo);

alter table modelos_contrato enable row level security;

-- Leitura pública só dos modelos ATIVOS (o fechamento lê sem depender de login).
drop policy if exists "modelos ativos públicos" on modelos_contrato;
create policy "modelos ativos públicos" on modelos_contrato
  for select using (ativo = true);

-- Esqueleto: um modelo (inativo, vazio) por faixa, para o admin preencher depois.
insert into modelos_contrato (faixa, titulo, conteudo, ativo)
select f.faixa, f.titulo, null, false
from (values
  ('temporada'::faixa_prazo, 'Contrato de locação por temporada'),
  ('media_estadia'::faixa_prazo, 'Contrato de média estadia'),
  ('longa'::faixa_prazo, 'Contrato de locação de longa duração')
) as f(faixa, titulo)
where not exists (select 1 from modelos_contrato m where m.faixa = f.faixa);
