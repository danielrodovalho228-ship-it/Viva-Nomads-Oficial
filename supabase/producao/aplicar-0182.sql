-- Viva Nomads — 0182: pagamento sem repetição, Caução do contrato, anulação do CAU-2026-000002 (contas de teste). Idempotente.
-- Rollback: supabase/producao/rollback/0182_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

-- 1) Pagamento ANULADO (registro em duplicidade): nunca se apaga — fica com a data e o motivo.
alter table public.pagamentos_bloco add column if not exists anulado_em timestamptz;
alter table public.pagamentos_bloco add column if not exists anulado_motivo text;
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_anulacao;
alter table public.pagamentos_bloco add constraint pagamentos_bloco_anulacao
  check ((anulado_em is null and anulado_motivo is null)
         or (anulado_em is not null and length(btrim(coalesce(anulado_motivo, ''))) >= 5));

-- 2) Caução é do CONTRATO, não do bloco: bloco_id passa a ser opcional e fica vazio na Caução.
alter table public.pagamentos_bloco alter column bloco_id drop not null;
-- A Caução passa para o nível do contrato (bloco vazio) ANTES do check abaixo: o check NOT VALID também vale para
-- as linhas atualizadas depois, e a anulação das duplicidades (passo 3) tocava Caução ainda com bloco — foi o que
-- fez a 0182 falhar em produção em 19/10 ("violates check constraint pagamentos_bloco_bloco_por_tipo").
create table if not exists public._bkp_0182_caucao_bloco (id uuid primary key, bloco_id uuid);
alter table public._bkp_0182_caucao_bloco enable row level security;
revoke all on public._bkp_0182_caucao_bloco from anon, authenticated;
insert into public._bkp_0182_caucao_bloco (id, bloco_id)
select id, bloco_id from public.pagamentos_bloco where tipo = 'caucao' and bloco_id is not null
on conflict (id) do nothing;
update public.pagamentos_bloco set bloco_id = null where tipo = 'caucao' and bloco_id is not null;
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_bloco_por_tipo;
alter table public.pagamentos_bloco add constraint pagamentos_bloco_bloco_por_tipo
  check ((tipo = 'caucao' and bloco_id is null) or (tipo = 'aluguel' and bloco_id is not null)) not valid;

-- O dono registra: Caução sem bloco; valor mensal num bloco DO MESMO contrato (como na 0057).
drop policy if exists "proprietário registra recebimento" on public.pagamentos_bloco;
create policy "proprietário registra recebimento" on public.pagamentos_bloco
  for insert with check (
    marcado_por = auth.uid()
    and coalesce(confirmado_pelo_inquilino, false) = false
    and confirmado_em is null
    and anulado_em is null
    and exists (
      select 1 from public.contratos c join public.properties p on p.id = c.property_id
      where c.id = pagamentos_bloco.contrato_id and p.owner_id = auth.uid()
    )
    and (
      (pagamentos_bloco.tipo = 'caucao' and pagamentos_bloco.bloco_id is null)
      or (pagamentos_bloco.tipo = 'aluguel' and exists (
        select 1 from public.contrato_blocos b
        where b.id = pagamentos_bloco.bloco_id and b.contrato_id = pagamentos_bloco.contrato_id
      ))
    )
  );

-- 3) Limpeza das duplicidades de CONTAS DE TESTE (19/10: Caução 3ee7092c registrada 0,3 s depois da f5f13b38, que
--    gerou o CAU-2026-000002). Fica o registro mais antigo; os outros e os documentos deles são ANULADOS.
--    Conta real com duplicidade: nada é tocado e o índice abaixo falha — a decisão volta para o Daniel.
with dup as (
  select p.id, row_number() over (
           partition by p.contrato_id, p.tipo, case when p.tipo = 'aluguel' then p.bloco_id end
           order by p.created_at, p.id) as ordem
    from public.pagamentos_bloco p
    join public.profiles pr on pr.id = p.marcado_por and pr.is_teste
   where p.anulado_em is null
)
update public.pagamentos_bloco p
   set anulado_em = now(), anulado_motivo = 'registro em duplicidade'
  from dup
 where dup.id = p.id and dup.ordem > 1;

update public.documentos_fiscais d
   set anulado_em = now(), anulado_motivo = 'registro em duplicidade'
  from public.pagamentos_bloco p
 where d.pagamento_id = p.id and p.anulado_motivo = 'registro em duplicidade' and d.anulado_em is null;

-- O documento anulado não volta para a fila "Documentos com falha".
update public.documentos_falhas f
   set resolvido_em = now()
  from public.pagamentos_bloco p
 where f.pagamento_id = p.id and p.anulado_em is not null and f.resolvido_em is null;


-- 4) Sem repetição: uma Caução ativa por contrato; um pagamento de valor mensal ativo por bloco
--    (pagamento parcial de bloco, se um dia for desejado, é decisão do Daniel).
create unique index if not exists pagamentos_bloco_uma_caucao
  on public.pagamentos_bloco (contrato_id) where tipo = 'caucao' and anulado_em is null;
create unique index if not exists pagamentos_bloco_um_valor_mensal
  on public.pagamentos_bloco (bloco_id) where tipo = 'aluguel' and anulado_em is null;

-- 5) Conferência pública: o número do contrato no formato da plataforma (VN-CT-11281A61) e o motivo da anulação.
drop function if exists public.conferir_documento(text);
create function public.conferir_documento(p_codigo text)
returns table (numero text, tipo text, valor numeric, emitido_em timestamptz, periodo_inicio date, periodo_fim date,
               locador text, locatario text, anulado_em timestamptz, anulado_motivo text, contrato text)
language sql
stable
security definer
set search_path = public
as $$
  select d.numero, d.tipo, d.valor, d.criado_em, d.periodo_inicio, d.periodo_fim,
         public.iniciais(d.locador_nome), public.iniciais(d.locatario_nome), d.anulado_em, d.anulado_motivo,
         case when d.contrato_id is null then null else 'VN-CT-' || upper(left(d.contrato_id::text, 8)) end
  from public.documentos_fiscais d
  where p_codigo ~ '^[0-9a-f]{32}$' and d.codigo_verificacao = p_codigo
$$;
revoke all on function public.conferir_documento(text) from public;
grant execute on function public.conferir_documento(text) to anon, authenticated, service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000182', '0182_pagamento_sem_repeticao',
       array['-- conteúdo em supabase/migrations/0182_pagamento_sem_repeticao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000182');
commit;
