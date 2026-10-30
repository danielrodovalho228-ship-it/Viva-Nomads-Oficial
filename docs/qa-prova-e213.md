# Roteiro da prova ao vivo — E213: limpeza da saída × renovação

Massa: migração **0261** (`supabase/migrations/0261_qa_limpeza_renovacao_e213.sql`), aplicada pela Action no merge.
**Nada dispara sozinho com ela.** Quem renova é o Muse, no circuito dele. Levantado em 30/10/2026 lendo o código da `main`
(`src/lib/automacao/remarcacao.ts`, `servidor.ts`, `reagendamento-servidor.ts`) e o banco de produção (só leitura).

Não toca:
- a seed do D-5: contrato `d5d50247…`, Premium `330ebf37`, parceiro de proprietario3cnpj@ e a Ana;
- a massa da 0260 (Carteira 2, cadastro1);
- a chave `AUTOMACOES_ATIVO`.

## O desenho validado (o que o código faz no aditivo assinado → `estadia_remarcada`)

| Pedido da saída | A nova saída | O que acontece |
|---|---|---|
| **Sem aceite** (solicitado/orçado) | a mais de 5 dias | **cancela**; a chave ganha `:remarcado:<ts>`; o cron **refaz no D-5 da nova saída** com a chave original |
| **Sem aceite** | a até 5 dias | o mesmo pedido ganha a janela nova (não cabe aqui: a prorrogação é de 1 mês) |
| **Aceito / agendado** | qualquer | **reagendamento**: volta a "aceito" com os horários da janela nova, o horário confirmado cai, **o valor fica**; o parceiro confirma um horário novo (o aditivo assinado é o OK do dono) ou recusa a nova data |
| Sugestão de parceiros à moradora (D-7) | — | a chave leva a data da saída: **sai de novo no D-7 da nova saída** |

## A massa (0261) — D = o dia em que a Action aplica

| | Caminho (a) — sem aceite | Caminho (b) — aceito |
|---|---|---|
| Contrato | `a0261a00-0000-4000-8000-000000000022` (**VN-CT-A0261A00**) | `a0261b00-0000-4000-8000-000000000032` (**VN-CT-A0261B00**) |
| Anúncio | "[TESTE QA] Carteira 1" (`b30ddd02…`) | "[TESTE QA NÍVEL] Conforto" (`57bcac8e…`) |
| Dono / moradora | proprietario1@ / **cadastro2@** | proprietario1@ / **cadastro3@** |
| Bloco 1 | D−26 a **D+4** (a saída) | D−26 a **D+4** |
| Pedido da saída | **VN-SV-E213A261**, `solicitado` | **VN-SV-E213B261**, `agendado`, R$ 250 (você recebe R$ 225), horário confirmado no início da janela |
| Janela da limpeza | D+4 13:00 até D+6 11:00 (Brasília) | a mesma |

- **Parceiro fixo** dos dois anúncios: "[TESTE QA] Limpeza E213" (conta **cadastro-teste-2310@**), em modo **automático**.
- Os dois pedidos têm a mesma chave que o cron do D-5 usaria (`<imóvel>:limpeza:<contrato>:saida`), então o cron não cria outro.
- Todas as contas são de teste: os e-mails caem em `emails_teste`.

## A consulta do estado (antes e depois de cada marco)

```sql
select p.codigo, p.status, p.chave_automacao, p.valor_combinado, p.horario_confirmado,
       p.janela_inicio at time zone 'America/Sao_Paulo' as janela_inicio, p.criado_em
  from parceiro_pedidos p
 where p.contrato_id in ('a0261a00-0000-4000-8000-000000000022', 'a0261b00-0000-4000-8000-000000000032')
 order by p.contrato_id, p.criado_em;

select e.pedido_id, e.tipo, e.dados, e.criado_em from parceiro_pedido_eventos e
 where e.pedido_id in (select id from parceiro_pedidos where contrato_id in
       ('a0261a00-0000-4000-8000-000000000022', 'a0261b00-0000-4000-8000-000000000032'))
 order by e.criado_em;

select pr.email, e.evento, e.assunto, e.criado_em from emails_teste e join profiles pr on pr.id = e.usuario_id
 where pr.email in ('proprietario1@vivanomads.com.br', 'cadastro2@vivanomads.com.br', 'cadastro3@vivanomads.com.br',
                    'cadastro-teste-2310@vivanomads.com.br')
   and e.criado_em > now() - interval '3 days'
 order by e.criado_em;

select chave, criado_em from automacoes_envios where chave like '%a0261a00-0000-4000-8000-000000000022%' or chave like '%a0261b00-0000-4000-8000-000000000032%' order by criado_em;
```

## Marcos

**M0 — Estado zero (logo depois do merge).**
- Pedido (a): `solicitado`, chave sem sufixo.
- Pedido (b): `agendado`, com R$ 250 e horário confirmado.
- Na **primeira rodada do cron depois do merge** (10:00 de Brasília), a saída está a 4 dias, dentro do D-7:
  - sai **uma** `sugestao_parceiros_morador` para cadastro2 e uma para cadastro3;
  - a chave termina na **saída de agora** (`…:saida:<D+4>`). Essa é a linha de base do re-disparo.
- O cron **não** cria outro pedido de limpeza: a chave já existe.

**M1 — Renovação do contrato (a).**
1. **proprietario1** abre `/dashboard/estadia/a0261a00-0000-4000-8000-000000000022/alteracao?renovar=1`.
2. Muda o prazo de **1 para 2 meses** e envia.
3. **cadastro2** aceita o aditivo na página da estadia.
4. Os dois tocam "Assinar" e digitam o código do e-mail.

Na **2ª assinatura**:
- **Pedido (a):** `cancelado`, com chave `…:saida:remarcado:<ts>`, e um evento `cancelar` com `{"motivo": "saida_remarcada"}`.
- **E-mail ao parceiro** (cadastro-teste-2310): `pedido_auto_cancelado`. Texto: "a saída do morador mudou e este pedido foi cancelado. O pedido volta a ser feito perto da nova data."
- **Na conversa do pedido:** "A saída mudou; o pedido volta a ser feito perto da nova data."
- **Para as duas partes:** `estadia_remarcada` ("O aditivo foi assinado").
- **Nenhum pedido novo nasce agora.** A nova saída é **D+34**, a mais de 5 dias.

**M2 — Renovação do contrato (b).** O mesmo do M1, com `…-000000000032` e **cadastro3**.

Na **2ª assinatura**, o pedido (b) muda assim:

| Campo | Depois da 2ª assinatura |
|---|---|
| `status` | `aceito` (era `agendado`) |
| `horario_confirmado` | vazio |
| `valor_combinado` | **continua R$ 250** |
| `janela_inicio` | o dia **D+34** às 13:00 |
| `horarios_propostos` | os novos, dentro da janela |
| Evento | `reagendamento`, com `{"de": "agendado"}` |
| Chave | **sem sufixo** (o mesmo pedido) |

E-mails e mensagens:
- **E-mail ao parceiro:** `pedido_auto_atualizado`. Texto: "a estadia foi renovada e a data do serviço mudou. Confirme um dos novos horários ou recuse a nova data pelo pedido. O valor combinado continua o mesmo."
- **Na conversa do pedido:** "Nova janela: entre …".
- **Para o dono:** nenhum pedido de aprovação. O aditivo assinado é o OK dele.

**M3 — O parceiro confirma pelo mesmo valor (b).**
1. **cadastro-teste-2310** abre `/dashboard/servicos/pedidos/<id do VN-SV-E213B261>`.
2. Confirma um dos novos horários.

Resultado:
- Pedido `agendado`, `horario_confirmado` na janela nova, **valor R$ 250**.
- Sem orçamento novo e sem pedido de aprovação ao dono.
- E-mail `parceiro_horario_confirmado` para as duas partes.

*Alternativa do caminho (b): o parceiro **recusa a nova data**.*
- A nova saída está a mais de 5 dias, então o pedido é **cancelado** com o sufixo `:remarcado:`.
- O evento é `recusar_nova_data`, com `{"caminho": "cancelar_remarcado"}`.
- O dono recebe "o parceiro recusou a nova data da limpeza. O pedido foi cancelado e volta a ser feito perto da nova saída."
- Faça a recusa **ou** a confirmação, não as duas.

**M4 — Re-disparo da sugestão no D-7 da nova saída** (data fixa: **D+27**, na rodada das 10:00).
- Uma **segunda** `sugestao_parceiros_morador` para cada moradora.
- A nova chave termina em `…:saida:<D+34>`. A de M0 continua lá: são **duas linhas por moradora**, uma por saída.

**M5 — O pedido (a) refeito no D-5 da nova saída** (data fixa: **D+29**, na rodada das 10:00).
- **Um pedido novo** no contrato (a): `solicitado`, com a **chave original sem sufixo** e a janela de D+34 às 13:00.
- E-mail `parceiro_pedido_novo` ao parceiro.
- O cancelado de M1 continua cancelado, com o sufixo.
- No contrato (b) **não nasce pedido novo**: a chave dele está ocupada pelo pedido reagendado.

As datas de M4 e M5 contam a partir de **D+34**, a nova saída se a prorrogação for de 1 mês. Confira o fim do bloco 2
na página da estadia depois da assinatura. Se for outro dia, M4 = fim − 7 e M5 = fim − 5.

## Prazos e o que invalida a prova

- **Renove no próprio dia D (até as 10:00 de Brasília de D+1).** Senão, sai sozinho o que é da saída antiga:
  - o lembrete de saída a 3 dias exatos (D+1);
  - o aviso de 24 h sem resposta do pedido (a) ao dono (D+1);
  - o lembrete de 24 h do serviço agendado (b) (D+3).

  Isso não estraga o E213, mas suja a caixa de teste.
- **Depois de D+4** a saída passou: a massa venceu (rollback e nova aplicação).
- **Esperado depois da renovação**, porque o bloco 2 começa em D+5: o cron de D+2 manda `bloco_inicio_lembrete` às duas moradoras. É a regra do lembrete de bloco, não ruído do E213.
- **Não registre pagamento** nem conclua o serviço no pedido (b) antes do M2. Em execução, entregue ou concluído, a renovação não mexe no pedido, de propósito.
- **Não troque de parceiro** nos anúncios da massa.

## Desfazer

`supabase/producao/rollback/0261_rollback.sql` apaga:
- os pedidos de limpeza dos dois contratos: os da massa, os cancelados com `:remarcado:` e o refeito no D-5;
- os eventos e o registro VN-SV desses pedidos;
- os dois contratos, com os blocos, os aditivos e o registro VN-CT;
- as chaves de envio que citam os contratos ou os pedidos;
- os vínculos, o serviço, o parceiro de teste e a solicitação dele.

Tudo é apagado pelos ids fixos `a0261000-…`, `a0261a00-…` e `a0261b00-…`. Nada de outro contrato é tocado (testado num Postgres local com uma linha
da seed do D-5 ao lado).
