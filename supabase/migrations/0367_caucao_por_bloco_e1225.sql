-- 0367 (E1225, ORDEM-DUET-1120 do Gerente, 26/11/2026): a caução passa a ser registrada POR BLOCO.
--
-- Para quê: a regra do Daniel (20/11) é caução = 50% de CADA bloco, paga no início de cada bloco, e
-- contrato_blocos.caucao já guarda uma por bloco. Mas o registro era UM por contrato (índice único por contrato_id,
-- bloco_id nulo — 0182), e a caução do 2.º bloco não tinha onde entrar. Agora cada caução vai com o seu bloco, com o
-- seu comprovante e a sua confirmação do morador.
--
-- O teto NÃO mora aqui: é o acumulado, calculado na leitura (src/lib/caucao-teto.ts) — o que ainda se pode registrar
-- até ao bloco k = a soma das cauções dos blocos 1..k − a caução já registrada e ativa. Um registro antigo pela soma
-- cobre os blocos seguintes até ao valor dele.
--
-- O que NÃO faz: não regrava, não apaga e não anula linha nenhuma. As cauções de antes ficam sem bloco, ligadas ao
-- contrato. Sem dado pessoal.
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
