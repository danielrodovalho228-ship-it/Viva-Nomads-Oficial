-- Rollback da 0306 (E627): volta a função do ciclo à da 0063 (sem o passo e). Contratos já fechados pelo passo (e) ficam fechados.
begin;
create or replace function public.avancar_ciclo_blocos()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- (0) Proposta de renovação sem os dois aceites até o dia de início: caduca.
  update contrato_blocos
     set status = 'nao_aceito', encerrado_em = coalesce(encerrado_em, now())
   where status = 'pendente_aceite' and inicio <= hoje;

  -- (a) Ativa blocos ACEITOS que entraram em vigência hoje.
  update contrato_blocos
     set status = 'ativo'
   where status = 'agendado' and inicio <= hoje and fim >= hoje;

  -- (b) Bloco vencido com sucessor ACEITO → 'renovado'.
  update contrato_blocos b
     set status = 'renovado', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado', 'ativo') and b.fim < hoje
     and exists (select 1 from contrato_blocos n
                  where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1
                    and n.status in ('agendado', 'ativo', 'renovado', 'encerrado', 'encerrado_sem_renovacao'));

  -- (c) Bloco vencido SEM sucessor aceito → encerra sem renovação.
  update contrato_blocos b
     set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado', 'ativo') and b.fim < hoje
     and not exists (select 1 from contrato_blocos n
                      where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1
                        and n.status in ('agendado', 'ativo', 'renovado', 'encerrado', 'encerrado_sem_renovacao'));

  -- (d) Contrato-mãe sem bloco vigente/aceito e com bloco encerrado sem
  --     renovação → 'encerrado_sem_renovacao'.
  update contratos c
     set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(c.encerrado_em, now())
   where c.status = 'ativo'
     and exists (select 1 from contrato_blocos b where b.contrato_id = c.id and b.status = 'encerrado_sem_renovacao')
     and not exists (select 1 from contrato_blocos b where b.contrato_id = c.id and b.status in ('agendado', 'ativo'));
end
$fn$;
delete from supabase_migrations.schema_migrations where version = '20261105000306';
commit;
