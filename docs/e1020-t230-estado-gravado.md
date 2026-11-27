# E1020 — t230 caso 1: "Caução registrada" sumia antes de o teste olhar

**Sintoma (2 corridas: 17/11 com 2 workers, run 44038091791; prova da T3 com 1 worker, run 44114328109):**
`getByTestId('caucao-contrato').getByTestId('recebimento-registrado')` — *element(s) not found* em 20 s. Os casos 2 e 3
são cadeia em série do caso 1 e entraram juntos na quarentena.

## Causa (lab, 18/11) — teste

"Caução registrada" é a mensagem do formulário `RegistrarRecebimento`. Logo depois de gravar, ele chama
`router.refresh()`; com os dados novos, a tela troca o formulário pelo estado gravado (`caucao-contrato-status`:
"Recebimento registrado. Aguardando a confirmação do morador."). A mensagem é passageira: com o runner lento, o teste
olhava depois da troca e não a achava. O produto está certo (o estado gravado aparece, e o banco tem 1 registro).

Não é defeito de idempotência: o clique duplo grava 1 (a asserção `contar(...) === 1` continua e passa) e a 2ª aba
recebe "Este recebimento já foi registrado".

## Prova vermelha na main (b4b0bc715)

Mesma asserção, com o runner "lento" simulado (`waitForTimeout(5_000)` logo depois do clique duplo):
`1 failed — getByTestId('caucao-contrato').getByTestId('recebimento-registrado') element(s) not found` (o erro do CI).
Sem o atraso, `--repeat-each=6 --workers=3` passa 18/18: a corrida depende da velocidade do runner.

## Correção (só no teste)

Vale a mensagem do formulário **ou** o estado gravado e, em seguida, o estado gravado tem de aparecer
("Recebimento registrado"). A guarda das cadeias passa a esperar só a do t321 (E1022).

## Prova verde

- com o mesmo atraso de 5 s: t230 inteiro **3 passed**;
- sem atraso, `--repeat-each=4 --workers=2`: **12 passed**;
- guardas `e744-t2-quarentena` + `e744-t1-disposicao-das-falhas`: pass 30, fail 0.

## 2.ª frente (ORDEM-DUET-231, 20/11) — caso 3: a confirmação perdia um pagamento

**Medição na main d8d12290e (lab, chromium, sem retries):** t230 isolado `--repeat-each=10 --workers=2` → **2 failed, 28 passed**.
As 2 falhas são no **caso 3** (o caso 1 do #3982 passou as 10): `expect.poll(... documentos_fiscais ... pagamento_id = caução).not.toBeNull()`
esgota os 45 s. Taxa no caso 3: 2/10.

**Causa (teste):** o caso 3 confirmava os pagamentos com **3 cliques fixos** no primeiro "Confirmar" e 800 ms de pausa, sem esperar o
efeito. Um clique perdido (antes da hidratação, ou durante o `router.refresh()` que troca a lista) deixa um pagamento por
confirmar. A lista do inquilino vem de `pagamentos_bloco` embutido **sem ORDER BY** (`contratos-actions.ts`), então a ordem é a do
heap e muda a cada UPDATE; quando a Caução não é a primeira, é ela que sobra — sem confirmação não sai o documento fiscal dela.
O snapshot da falha mostra exatamente isso: "Caução do contrato — R$ 6.400 … Confirmar" ainda na lista, os blocos 1 e 2 já com recibo.

**Prova determinística (sonda local, fora do commit):** Caução forçada para o fim da lista (UPDATE regrava a linha) + 1 clique perdido:
- teste antigo: **1 failed** (o mesmo erro do CI, linha do `expect.poll` dos 45 s);
- teste novo: **3 passed**.

**Correção (só no teste):** confirma até a lista esvaziar; depois de cada clique espera a lista encolher (se não encolher, clica
de novo, até 10 vezes); no fim exige a lista vazia ("os 3 pagamentos ficam confirmados").

**Trava de estabilidade:** `--repeat-each=20 --workers=2 --retries=0` → **60 passed**. Porquê 20: com a taxa medida no caso 3
(2/10 = 20 %), 20 verdes seguidos sem a correção teriam probabilidade 0,8^20 ≈ 1 %.

**Fora do âmbito (produto):** a lista "Pagamentos para confirmar" não tem ordem fixa. Não é defeito de dados (cada clique confirma o
pagamento certo, pelo id), mas a ordem pode mudar entre recargas. Se o Gerente quiser, é um `order("data_pagamento")` no embutido,
num item próprio.
