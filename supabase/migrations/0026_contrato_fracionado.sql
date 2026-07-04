-- Contrato fracionado em BLOCOS (v2) — contrato-mãe + blocos, comissão por
-- contrato-mãe, controle de ocupação e caução por bloco (cálculo/registro; a
-- CAPTURA de dinheiro NÃO é feita aqui — regra de ouro: a plataforma nunca
-- retém valores). Estrutura pronta; o go-live do fracionamento aguarda o
-- parecer jurídico (itens 8 e 9). Reutiliza o enum `faixa_prazo` (0022).
--
-- Convive com `locacoes` (0025), que fica intacta para histórico. A partir daqui
-- o fechamento registra o CONTRATO-MÃE em `contratos` + seus `contrato_blocos`.

-- ── 1) Contrato-mãe ──────────────────────────────────────────────────────────
-- Registro do prazo total pretendido declarado no fechamento. A COMISSÃO vive
-- aqui (1 mês × taxa do plano, UMA vez) — renovar/estender blocos NÃO recobra.
create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  owner_plan text not null default 'essential',
  faixa faixa_prazo not null,
  prazo_total_dias int not null check (prazo_total_dias >= 1),
  aluguel_mensal numeric(12,2) not null,
  tamanho_bloco_meses int not null default 2 check (tamanho_bloco_meses between 1 and 3),
  comissao_percent numeric(5,4) not null default 0,      -- 0..1 (snapshot do plano)
  comissao_valor numeric(12,2) not null default 0,       -- 1 mês × %, UMA vez
  qtd_ocupantes int not null check (qtd_ocupantes >= 1),
  capacidade_snapshot int,                                -- max_guests no fechamento
  -- Fase 3: ganchos de ocorrência/multa (estrutura; fluxo completo depois).
  ocorrencia_ocupacao jsonb,
  multa_status text not null default 'nenhuma'
    check (multa_status in ('nenhuma','registrada','cobrada','cancelada')),
  ocupacao_verificada int,                                -- concierge confere a ocupação real
  status text not null default 'ativo'
    check (status in ('ativo','encerrado_sem_renovacao','concluido','cancelado')),
  encerrado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contratos_property_idx on contratos (property_id);
create index if not exists contratos_tenant_idx on contratos (tenant_id);
create index if not exists contratos_status_idx on contratos (status);

-- ── 2) Blocos do contrato ────────────────────────────────────────────────────
-- Cada bloco cabe no cartão e carrega a caução INTEGRAL (50% do valor do bloco).
-- Nenhum bloco excede 90 dias (art. 48, Lei 8.245/91) — imposto por CHECK.
create table if not exists contrato_blocos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  numero_bloco int not null check (numero_bloco >= 1),
  inicio date not null,
  fim date not null,
  meses int not null check (meses between 1 and 3),
  valor numeric(12,2) not null,                           -- aluguel × meses do bloco
  caucao numeric(12,2) not null,                          -- 50% do valor do bloco
  -- Caução: só a INTENÇÃO/forma é registrada; sem captura (Fase 4/placeholder).
  caucao_forma text not null default 'avista'
    check (caucao_forma in ('avista','preauth_cartao')),
  caucao_status text not null default 'pendente'
    check (caucao_status in ('pendente','comprovada')),
  status text not null default 'agendado'
    check (status in ('agendado','ativo','encerrado','renovado','encerrado_sem_renovacao')),
  renovacao_notificada_em timestamptz,
  encerrado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint bloco_max_90_dias check (fim - inicio <= 90),
  unique (contrato_id, numero_bloco)
);

create index if not exists blocos_contrato_idx on contrato_blocos (contrato_id);
create index if not exists blocos_fim_idx on contrato_blocos (fim);

-- ── 3) RLS — as duas partes leem; o inquilino cria (espelha `locacoes`) ──────
alter table contratos enable row level security;
alter table contrato_blocos enable row level security;

drop policy if exists "contrato visível às partes" on contratos;
create policy "contrato visível às partes" on contratos
  for select using (
    tenant_id = auth.uid()
    or exists (
      select 1 from properties p
      where p.id = contratos.property_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "inquilino cria contrato" on contratos;
create policy "inquilino cria contrato" on contratos
  for insert with check (tenant_id = auth.uid());

-- Renovação/encerramento partem das duas partes (dono ou inquilino).
drop policy if exists "partes atualizam contrato" on contratos;
create policy "partes atualizam contrato" on contratos
  for update using (
    tenant_id = auth.uid()
    or exists (
      select 1 from properties p
      where p.id = contratos.property_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "bloco visível às partes" on contrato_blocos;
create policy "bloco visível às partes" on contrato_blocos
  for select using (
    exists (
      select 1 from contratos c
      where c.id = contrato_blocos.contrato_id
        and (
          c.tenant_id = auth.uid()
          or exists (
            select 1 from properties p
            where p.id = c.property_id and p.owner_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "partes criam bloco" on contrato_blocos;
create policy "partes criam bloco" on contrato_blocos
  for insert with check (
    exists (
      select 1 from contratos c
      where c.id = contrato_blocos.contrato_id
        and (
          c.tenant_id = auth.uid()
          or exists (
            select 1 from properties p
            where p.id = c.property_id and p.owner_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "partes atualizam bloco" on contrato_blocos;
create policy "partes atualizam bloco" on contrato_blocos
  for update using (
    exists (
      select 1 from contratos c
      where c.id = contrato_blocos.contrato_id
        and (
          c.tenant_id = auth.uid()
          or exists (
            select 1 from properties p
            where p.id = c.property_id and p.owner_id = auth.uid()
          )
        )
    )
  );

-- ── 4) Ciclo dos blocos — transições de estado (idempotente) ─────────────────
-- Roda por pg_cron (diário) E é chamada pela checagem lazy no app. Só muda
-- ESTADO; a notificação (in-app + e-mail) às partes é feita pelo app. A
-- renovação é sempre OPT-IN — esta função NUNCA cria um bloco novo.
create or replace function avancar_ciclo_blocos() returns void
language plpgsql security definer set search_path = public as $fn$
begin
  -- (a) Ativa blocos que entraram em vigência hoje.
  update contrato_blocos
     set status = 'ativo'
   where status = 'agendado' and inicio <= current_date and fim >= current_date;

  -- (b) Bloco vencido COM sucessor (houve renovação opt-in) → 'renovado'.
  update contrato_blocos b
     set status = 'renovado', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado','ativo') and b.fim < current_date
     and exists (
       select 1 from contrato_blocos n
       where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1
     );

  -- (c) Bloco vencido SEM sucessor (NÃO-renovação) → encerra o bloco.
  update contrato_blocos b
     set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado','ativo') and b.fim < current_date
     and not exists (
       select 1 from contrato_blocos n
       where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1
     );

  -- (d) Contrato-mãe sem bloco ativo/agendado e com bloco encerrado sem
  --     renovação → 'encerrado_sem_renovacao' (registra data/hora do evento).
  update contratos c
     set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(c.encerrado_em, now())
   where c.status = 'ativo'
     and exists (
       select 1 from contrato_blocos b
       where b.contrato_id = c.id and b.status = 'encerrado_sem_renovacao'
     )
     and not exists (
       select 1 from contrato_blocos b
       where b.contrato_id = c.id and b.status in ('agendado','ativo')
     );
end $fn$;

grant execute on function avancar_ciclo_blocos() to authenticated, service_role;

-- ── 5) Agendamento por pg_cron (com fallback seguro) ─────────────────────────
-- Se o pg_cron não estiver disponível/habilitado, a migração NÃO falha — a
-- checagem lazy no app cobre o ciclo. Habilite o pg_cron no painel do Supabase
-- para o encerramento automático rodar mesmo sem ninguém abrir o painel.
do $cron$
begin
  create extension if not exists pg_cron;
  -- Remove agendamento anterior de mesmo nome (idempotência) e reagenda 06:00.
  perform cron.unschedule('avancar-ciclo-blocos')
    where exists (select 1 from cron.job where jobname = 'avancar-ciclo-blocos');
  perform cron.schedule('avancar-ciclo-blocos', '0 6 * * *', 'select avancar_ciclo_blocos();');
exception when others then
  raise notice 'pg_cron indisponível (%). A checagem lazy no app cobre o ciclo de blocos.', sqlerrm;
end $cron$;
