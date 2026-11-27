-- Viva Nomads — aplicar 0367 (E1225: a caução passa a uma por BLOCO — o índice único por contrato dá lugar ao por
-- bloco; as cauções de antes, sem bloco, continuam uma por contrato). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. NÃO regrava, apaga nem anula linha nenhuma.
-- Rollback: supabase/producao/rollback/0367_rollback.sql.
begin;
set local lock_timeout = '5s';

-- 1) A forma: a caução pode ter bloco (as novas) ou não (as de antes, ligadas ao contrato); o aluguel continua com
--    bloco. NOT VALID como na 0182: as linhas que existem não são reconferidas (e nenhuma muda).
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_bloco_por_tipo;
alter table public.pagamentos_bloco add constraint pagamentos_bloco_bloco_por_tipo
  check (tipo = 'caucao' or (tipo = 'aluguel' and bloco_id is not null)) not valid;

-- 2) Sem repetição: uma caução ativa por BLOCO; as de antes, sem bloco, continuam uma por contrato. Os índices novos
--    nascem ANTES de o antigo sair: não há instante sem a regra.
create unique index if not exists pagamentos_bloco_uma_caucao_por_bloco
  on public.pagamentos_bloco (bloco_id) where tipo = 'caucao' and bloco_id is not null and anulado_em is null;
create unique index if not exists pagamentos_bloco_uma_caucao_sem_bloco
  on public.pagamentos_bloco (contrato_id) where tipo = 'caucao' and bloco_id is null and anulado_em is null;
drop index if exists public.pagamentos_bloco_uma_caucao;

-- 3) O dono registra: a caução num bloco DO MESMO contrato (ou, como antes, sem bloco); o valor mensal num bloco do
--    mesmo contrato (0182/0188, sem mudança).
alter policy "proprietário registra recebimento" on public.pagamentos_bloco
  with check (
    marcado_por = (select auth.uid())
    and coalesce(confirmado_pelo_inquilino, false) = false
    and confirmado_em is null
    and anulado_em is null
    and exists (
      select 1 from public.contratos c
        join public.properties p on p.id = c.property_id
       where c.id = pagamentos_bloco.contrato_id and p.owner_id = (select auth.uid())
    )
    and (
      (tipo = 'caucao' and bloco_id is null)
      or (tipo in ('aluguel', 'caucao') and exists (
        select 1 from public.contrato_blocos b
         where b.id = pagamentos_bloco.bloco_id and b.contrato_id = pagamentos_bloco.contrato_id
      ))
    )
  );

insert into supabase_migrations.schema_migrations (version, name)
select '20261126000367', '0367_caucao_por_bloco_e1225'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261126000367');
commit;
