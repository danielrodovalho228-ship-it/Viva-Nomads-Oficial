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
