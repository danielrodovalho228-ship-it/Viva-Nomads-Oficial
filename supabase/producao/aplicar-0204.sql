-- Viva Nomads — aplicar 0204 (Viva rodando automático — Prompt 38). Idempotente. Rollback: supabase/producao/rollback/0204_rollback.sql.
begin;
set local lock_timeout = '5s';
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- 0204 — "Viva rodando automático" (Prompt 38). Idempotente.
--
--  1. imovel_parceiros: parceiro fixo do imóvel por categoria (limpeza, manutenção, lavanderia, fotografia), com o
--     serviço (preço-base), o modo (confirmar | automatico) e as instruções. Nasce PENDENTE: o parceiro aceita ou
--     recusa. Só vínculo ATIVO dispara. Um por (imóvel, categoria) entre os não encerrados. Dono e admin leem; o
--     parceiro lê os dele; escrita só pelo servidor.
--  2. parceiro_pedidos: o pedido automático é um pedido normal do 31b (origem 'automatico', taxa de 10%) com a chave
--     de idempotência (imóvel:categoria:contrato:evento), o gatilho, o vínculo, o contrato, a janela, o "aguardando
--     o dono" (modo confirmar), quando foi ao parceiro e a marca do aviso de 24 h sem resposta. O pedido que espera o
--     dono não aparece para o parceiro (nem pela leitura direta).
--  3. conferencia_itens.precisa_reparo: o dono marca no registro da saída (as travas da conferência continuam valendo).
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- ── 1. Parceiros do imóvel ───────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.imovel_parceiros (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  categoria text not null check (categoria in ('limpeza', 'manutencao', 'lavanderia', 'fotografia')),
  parceiro_id uuid not null references public.parceiros (id) on delete cascade,
  servico_id uuid references public.parceiro_servicos (id) on delete set null,
  modo text not null default 'confirmar' check (modo in ('confirmar', 'automatico')),
  instrucoes text check (instrucoes is null or char_length(instrucoes) <= 200),
  status text not null default 'pendente' check (status in ('pendente', 'ativo', 'recusado', 'encerrado')),
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);
create unique index if not exists imovel_parceiros_um_por_categoria
  on public.imovel_parceiros (property_id, categoria) where status in ('pendente', 'ativo');
create index if not exists imovel_parceiros_parceiro_idx on public.imovel_parceiros (parceiro_id);
create index if not exists imovel_parceiros_servico_idx on public.imovel_parceiros (servico_id);

alter table public.imovel_parceiros enable row level security;
drop policy if exists "imovel_parceiros: dono lê" on public.imovel_parceiros;
create policy "imovel_parceiros: dono lê" on public.imovel_parceiros for select to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
drop policy if exists "imovel_parceiros: parceiro lê os dele" on public.imovel_parceiros;
create policy "imovel_parceiros: parceiro lê os dele" on public.imovel_parceiros for select to authenticated
  using (exists (select 1 from public.parceiros x where x.id = parceiro_id and x.user_id = (select auth.uid())));
drop policy if exists "imovel_parceiros: admin lê" on public.imovel_parceiros;
create policy "imovel_parceiros: admin lê" on public.imovel_parceiros for select to authenticated using (public.is_admin());
-- Escrita (criar, aceitar/recusar, encerrar, trocar o modo) só pelo servidor, que confere quem pode o quê.
revoke all on public.imovel_parceiros from anon, authenticated;
grant select on public.imovel_parceiros to authenticated;

-- ── 2. Pedido automático (o pedido do 31b com a origem 'automatico') ─────────────────────────────────────────────
alter table public.parceiro_pedidos
  add column if not exists chave_automacao text,
  add column if not exists gatilho text,
  add column if not exists vinculo_id uuid references public.imovel_parceiros (id) on delete set null,
  add column if not exists contrato_id uuid references public.contratos (id) on delete set null,
  add column if not exists janela_inicio timestamptz,
  add column if not exists janela_fim timestamptz,
  add column if not exists aguardando_dono boolean not null default false,
  add column if not exists enviado_em timestamptz,
  add column if not exists sem_resposta_avisado_em timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'parceiro_pedidos_gatilho_check') then
    alter table public.parceiro_pedidos add constraint parceiro_pedidos_gatilho_check
      check (gatilho is null or gatilho in ('saida_limpeza', 'saida_lavanderia', 'reparo_manutencao'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'parceiro_pedidos_automatico_com_chave') then
    -- Pedido automático sempre tem a chave (idempotência) e o gatilho; manual nunca tem.
    alter table public.parceiro_pedidos add constraint parceiro_pedidos_automatico_com_chave
      check ((origem = 'automatico') = (chave_automacao is not null and gatilho is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'parceiro_pedidos_janela_check') then
    alter table public.parceiro_pedidos add constraint parceiro_pedidos_janela_check
      check (janela_inicio is null or janela_fim is null or janela_fim > janela_inicio);
  end if;
end $$;
-- Um pedido por (imóvel, categoria, contrato, evento): a 2ª tentativa do mesmo disparo não cria outro.
create unique index if not exists parceiro_pedidos_chave_automacao on public.parceiro_pedidos (chave_automacao) where chave_automacao is not null;
create index if not exists parceiro_pedidos_contrato_idx on public.parceiro_pedidos (contrato_id) where contrato_id is not null;
create index if not exists parceiro_pedidos_vinculo_idx on public.parceiro_pedidos (vinculo_id) where vinculo_id is not null;
-- Leitura: o parceiro só enxerga o pedido automático depois do toque do dono (modo "confirmar").
drop policy if exists parceiro_pedidos_le on public.parceiro_pedidos;
create policy parceiro_pedidos_le on public.parceiro_pedidos for select to authenticated
  using ((public.parceiro_pedido_parte(id) and (not aguardando_dono or cliente_id = (select auth.uid()))) or public.is_admin());

-- ── 3. Conferência de saída: "precisa de reparo" ─────────────────────────────────────────────────────────────────
alter table public.conferencia_itens add column if not exists precisa_reparo boolean not null default false;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261022000204', '0204_viva_automatico',
       array['-- conteúdo em supabase/migrations/0204_viva_automatico.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261022000204');
commit;
