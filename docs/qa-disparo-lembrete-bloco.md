# Roteiro de disparo ao vivo — LEMBRETE DE INÍCIO DE BLOCO (`bloco_inicio_lembrete`)

Complementa `docs/qa-disparos-e204-e206.md` (#1582), item 10. É a massa da migração **0260**
(`supabase/migrations/0260_qa_contrato_lembrete_bloco.sql`). **Nada dispara sozinho com ela.** Quem dispara é o Muse, no
circuito dele, com a observadora. O roteiro foi levantado em 30/10/2026 lendo o código da `main` e o banco de produção
(só leitura).

## A regra (código: `src/lib/estadia/lembrete-bloco.ts`)
O lembrete vai **só à moradora**, uma vez por (contrato, bloco), quando as quatro condições valem:
- o bloco é o **2 ou posterior**;
- foi aceito pelas **duas partes** (status `agendado` ou `ativo`);
- **começa em até 3 dias**, contados no dia de Brasília;
- **não tem pagamento registrado**.

Ele tem duas portas, com a mesma regra:
- o **aditivo de prorrogação assinado pelas duas partes** (`aplicarAditivo` → `lembreteDeBlocoNoAceite`), que é a prova deste roteiro;
- o cron de automações, que só pega o bloco se ele ainda não tiver saído pela primeira porta (a chave em `automacoes_envios` segura a repetição).

## A massa (0260)
| | |
|---|---|
| Contrato | `a0260000-0000-4000-8000-000000000001` (VN-CT-A0260000), **ativo**, assinado pelas duas partes |
| Imóvel | "[TESTE QA] Carteira 2" (`297b71ec…`, pausado, do **proprietario1**, sem parceiro fixo) |
| Moradora | **cadastro1@vivanomads.com.br** (conta de teste; a Ana fica de fora, porque é a moradora do contrato da seed do D-5) |
| Bloco 1 | `a0260000-…-000000000002`, de **D−29 a D+2**, 1 mês, R$ 3.200, Caução R$ 3.200 pendente |
| D | o dia em que a Action aplica a 0260, no merge |

Por que nada sai sozinho:
- o lembrete de bloco ignora o bloco 1;
- o lembrete de saída sai só **a 3 dias exatos** do fim, e o fim está a 2;
- o aviso de renovação sai só a 15 dias;
- sem parceiro fixo, não nasce o pedido automático de limpeza.

**Janela da prova:** do dia D até **D+2**, o último dia do bloco 1. Nesse intervalo, o bloco 2 que a prorrogação cria começa
em **D+3**, ou seja, em até 3 dias. Depois de D+2, o bloco 1 acaba e a massa vence. Se vencer, é preciso o rollback mais
uma nova aplicação.

## Marcos

**M0. Antes (estado zero).** Na caixa de teste da **cadastro1** (Conta → Caixa de e-mails de teste), ou por consulta, não
existe nenhum `bloco_inicio_lembrete`.
```sql
select evento, assunto, criado_em from emails_teste
 where usuario_id = (select id from profiles where email = 'cadastro1@vivanomads.com.br')
   and evento = 'bloco_inicio_lembrete';                                  -- esperado: 0 linhas
select chave from automacoes_envios where chave like 'bloco_inicio_lembrete:a0260000-%';  -- esperado: 0 linhas
```

**M1. O dono propõe a prorrogação.** Entrar como **proprietario1** (porta de QA) e abrir
`/dashboard/estadia/a0260000-0000-4000-8000-000000000001/alteracao?renovar=1`. Mudar o **prazo total de 1 para 2 meses** e
enviar. A cadastro1 recebe "estadia_aditivo_proposto". Esse não é o lembrete.

**M2. A moradora aceita.** Entrar como **cadastro1** e, na mesma página da estadia, aceitar o aditivo. O dono recebe
"estadia_aditivo_respondido".

**M3. As duas partes assinam.** Cada uma toca em "Assinar". Sai o e-mail **"Seu código para assinar o contrato"**, com o
imóvel e "(aditivo 1)" (a prova do código de assinatura do **E206**). Cada uma digita o seu código. Na **segunda**
assinatura, o aditivo é aplicado: o bloco 2 nasce de D+3 a D+33 (aprox.), aceito pelas duas partes, sem pagamento.

**M4. O disparo.** Logo depois da segunda assinatura, segundos depois da resposta da tela:
```sql
select evento, assunto, corpo, criado_em from emails_teste
 where usuario_id = (select id from profiles where email = 'cadastro1@vivanomads.com.br')
   and evento = 'bloco_inicio_lembrete';                                  -- esperado: 1 linha
select chave from automacoes_envios where chave like 'bloco_inicio_lembrete:a0260000-%';  -- esperado: …:2
```
O que conferir no e-mail:
- **Assunto:** "O bloco 2 da sua estadia começa em dd/mm" (dd/mm = D+3);
- **Abertura:** "o bloco 2 da sua estadia em [TESTE QA] Carteira 2 começa em dd/mm/aaaa";
- **Quadro:**
  - **Imóvel** "[TESTE QA] Carteira 2";
  - **Datas do bloco** "dd/mm/aaaa a dd/mm/aaaa";
  - **Valor do bloco** com a conta aberta (o mesmo rótulo da página da estadia);
- **Linha do pagamento:** "O pagamento é direto ao proprietário; os dados estão na página da estadia.";
- **Botão:** "Ver a estadia", que leva a `/dashboard/estadia/a0260000-…`;
- **Não pode aparecer:**
  - "vence", "vencimento", "atraso";
  - dado bancário;
  - cobrança.
- **Destinatários:** sai **só para a moradora**. O proprietario1 **não** recebe `bloco_inicio_lembrete`.

**M5. Sem repetição.** Na manhã seguinte (o cron roda), a consulta do M4 continua com **1 linha**.

## O que invalida a prova
- **Registrar um pagamento do bloco 2 antes do M3:** o lembrete não sai, e isso está correto.
- **Fazer depois de D+2:** o bloco 1 já terminou e a massa venceu.
- **Usar outro contrato:** o `11281a61…` (Lucas) só entra na janela em 14 a 17/12, e o `d5d50247…` é da seed do D-5, que não se toca.

## Desfazer
`supabase/producao/rollback/0260_rollback.sql` apaga o contrato da prova, com o que a prova criou nele, o registro VN-CT
do contrato e dos aditivos, e as chaves do lembrete. Nenhum outro contrato é tocado.
