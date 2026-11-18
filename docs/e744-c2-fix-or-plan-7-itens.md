# E744 — Code 2: correção ou plano com data para os 7 itens em quarentena (DUET-1849, 18/11)

Regra: até 26/11 cada item tem correção escrita (PR) ou plano com data. No marco de 19/11 cada item confirma o caminho:
correção em curso, correção agendada com data, ou `test.fail()` com o número do item se a falha for determinística.
Validade de todas as entradas: 01/12 (teto de 14 dias, sem renovação em bloco). Pedido de renovação, se houver, item a
item ao Gerente até 28/11.

Método de cada item (o mesmo do E1014 e do E1022, que já saíram): reproduzir sob carga no lab (`--workers=6
--repeat-each`), achar o passo que trava, escrever a trava vermelha na main e corrigir a causa. Teste nunca é
afrouxado; se a causa for do produto, a correção é do produto.

| Item | Spec | Sintoma (1ª tentativa) | Hipótese de partida | Caminho | Data |
|---|---|---|---|---|---|
| E1011 | t29 chat sem aprovação | contagem de ordens 0 vem 1 (7/7) | o teste conta a tabela inteira de ordens; outro teste cria ordem ao mesmo tempo | correção do teste: contar só as ordens da própria conversa/conta; prova 10/10 com 6 workers | correção em curso 19/11, PR até 20/11 |
| E1019 | t1629 404 com busca | a busca da 404 cai em /buscar sem `?local=` (7/7) | toque antes do JavaScript (mesma classe do E1014): o formulário sai sem o campo | trava com o JavaScript atrasado (como o t2203) e correção no formulário da 404 | agendada 20/11, PR até 21/11 |
| E1015 | t190 SEO JSON-LD | "Unexpected end of JSON input" (7/7) | página fria: o teste lê o JSON-LD antes de a resposta chegar inteira, ou a página serve o bloco vazio | reproduzir frio; se for o produto (bloco vazio), corrigir o servidor; se for o teste, esperar o bloco completo | agendada 21/11, PR até 22/11 |
| E1016 | t305 laudo reprovado | "novo pedido, avaliador à sua escolha" não aparece (7/7) | texto que só aparece depois de uma gravação/refresh do painel; o teste lê antes | reproduzir sob carga e seguir o passo; correção onde estiver a causa | agendada 22/11, PR até 23/11 |
| E1010 | t21 Central de agentes | o passo do gerente ("Moacir → Viva" / "Tenho N chamado") não aparece (4/7) | resposta da Viva (falso de IA do lab) mais lenta sob carga, ou consulta ao banco antes de o chamado gravar | reproduzir sob carga; separar latência de corrida; corrigir a causa | agendada 24/11, PR até 25/11 |
| E1012 | t30 atendimento autônomo | "Resposta automática da Viva…" não aparece a tempo (3/7 instável, 1/7 vermelho) | a mesma via do E1010 (resposta automática); tratar junto se a causa for comum | junto com o E1010 se a causa for a mesma; senão, à parte | agendada 24/11, PR até 26/11 |
| E1020 | t230 pagamento sem repetição (caso 1 + cadeia 2–3) | clique duplo na Caução grava 1; a 2ª aba recebe "já foi registrado" (2 corridas) | corrida real entre as duas gravações (defeito possível de idempotência) ou a 2ª aba lida antes de a 1ª gravar | reproduzir com 2 abas e atraso; se gravar 2, é defeito: correção no servidor com trava | agendada 25/11, PR até 26/11 |

Se a reprodução mostrar uma falha determinística na main, o item passa a `test.fail()` com o número dele (e sai da
quarentena) até a correção entrar. Atualizo esta tabela no marco de 19/11 com o caminho confirmado de cada um.
