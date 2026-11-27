-- Viva Nomads — rollback da 0367 (E1225): volta a regra "uma caução ativa por contrato" e a caução sem bloco. Nunca
-- roda sozinho.
-- ATENÇÃO: se já existirem duas cauções ativas no mesmo contrato (uma por bloco, ou a de antes e uma por bloco), a
-- recriação do índice por contrato FALHA e a transação inteira é desfeita — nada muda. Nesse caso, primeiro decide-se o
-- que fazer com essas cauções; este script não apaga nem anula registro nenhum.
begin;
set local lock_timeout = '5s';
create unique index if not exists pagamentos_bloco_uma_caucao
  on public.pagamentos_bloco (contrato_id) where tipo = 'caucao' and anulado_em is null;
drop index if exists public.pagamentos_bloco_uma_caucao_por_bloco;
drop index if exists public.pagamentos_bloco_uma_caucao_sem_bloco;
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_bloco_por_tipo;
alter table public.pagamentos_bloco add constraint pagamentos_bloco_bloco_por_tipo
  check ((tipo = 'caucao' and bloco_id is null) or (tipo = 'aluguel' and bloco_id is not null)) not valid;
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
      or (tipo = 'aluguel' and exists (
        select 1 from public.contrato_blocos b
         where b.id = pagamentos_bloco.bloco_id and b.contrato_id = pagamentos_bloco.contrato_id
      ))
    )
  );
delete from supabase_migrations.schema_migrations where version = '20261126000367';
commit;
