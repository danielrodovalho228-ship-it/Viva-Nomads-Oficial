-- E627 (rodada 6, 05/11): um contrato encerrado de fato aparecia "Em vigência" e sem o botão da ação. Causa na regra de transição:
-- o ciclo diário (avancar_ciclo_blocos) só fecha o contrato quando algum bloco vira 'encerrado_sem_renovacao' PELO PRÓPRIO CICLO
-- (passo c). Um bloco que já está 'encerrado' (valor válido do schema, gravado pelo caminho manual e pela massa 0268) não cai em
-- nenhum passo: o contrato fica 'ativo' e sem encerrado_em para sempre, e a avaliação (que exige status encerrado + encerrado_em, 0089)
-- nunca abre — o selo diz "Encerrado" (E543, pelo período) e o botão não aparece.
-- Aqui: o passo (e) fecha o contrato 'ativo' cujos blocos TODOS já acabaram (nenhum agendado, ativo ou pendente de aceite, e o último
-- terminou) e que tem ao menos um bloco 'encerrado' ou 'encerrado_sem_renovacao'. encerrado_em = o fim real da estadia (o dia
-- seguinte ao último dia, 00h de Brasília), não o instante em que a rotina rodou — a janela de 14 dias para avaliar conta do fim.
-- Os passos (0) a (d) são os da 0063, sem mudança.
-- EXCEÇÃO TEMPORÁRIA: o contrato a0268b00-…0011 (estadia E289, encerrada em 30/10) NÃO é tocado por este passo enquanto o Daniel não
-- decidir sobre ele (guarda do Muse). Para liberar: nova migração que remove a linha "and c.id <> …" do passo (e).
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

  -- (e) E627: contrato 'ativo' cujos blocos todos já acabaram (o último bloco está 'encerrado' ou 'encerrado_sem_renovacao') →
  --     'encerrado_sem_renovacao', com encerrado_em no fim real da estadia (dia seguinte ao último dia, 00h de Brasília).
  update contratos c
     set status = 'encerrado_sem_renovacao',
         encerrado_em = coalesce(c.encerrado_em, (((select max(b.fim) from contrato_blocos b where b.contrato_id = c.id) + 1)::timestamp at time zone 'America/Sao_Paulo'))
   where c.status = 'ativo'
     and c.id <> 'a0268b00-0000-4000-8000-000000000011' -- exceção temporária (E289, aguardando decisão do Daniel)
     and exists (select 1 from contrato_blocos b where b.contrato_id = c.id and b.status in ('encerrado', 'encerrado_sem_renovacao'))
     and not exists (select 1 from contrato_blocos b where b.contrato_id = c.id and b.status in ('agendado', 'ativo', 'pendente_aceite'))
     and (select max(b.fim) from contrato_blocos b where b.contrato_id = c.id) < hoje;
end
$fn$;
