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

## Caminho confirmado de cada item (18/11, ~06:30 UTC — adianta o marco de 19/11)

| Item | Spec | Caminho | Onde | Data |
|---|---|---|---|---|
| E1011 | t29 | correção do teste (contar só as ordens da própria conversa) | PR #3974 (verde) | entra na vez dele, depois do #3965 |
| E1015 | t190 | correção do teste (JSON-LD do 1º anúncio que abre) | #3977 **mesclado** (17/11) | feito |
| E1019 | t1629 | linha de diagnóstico na main (#3977); correção depois da corrida completa mostrar onde o `?local=` se perde | main | correção até **21/11** |
| E1016 | t305 | correção do teste: cidade própria (t303/t344 apagavam a tabela de preços de Uberlândia) | PR #3978 (verde) | entra na vez dele; prazo 26/11 cumprido |
| E1010 | t21 | correção do produto (trilha "ver como apurei" aberta não fecha) + teste espera a própria resposta | PR #3979 (verde) | entra na vez dele; prazo 26/11 cumprido |
| E1012 | t30 | correção do produto (a resposta automática do acolhimento aparece sem recarregar) | #3981 **mesclado** (18/11) | feito |
| E1020 | t230 (caso 1 + cadeia 2–3) | correção do teste (vale o estado gravado da Caução; não é defeito de idempotência) | PR #3982 (verde; refresco depois do #3972) | entra na vez dele; prazo 26/11 cumprido |

Nenhum item precisa de renovação da validade (01/12). Detalhe de cada correção em `docs/e10NN-*.md` do PR respectivo.

## Marco de 19/11 — pacote do Code 2 (estado em 18/11, ~11:00 UTC; ORDEM-DUET-103)

Este é o ponto de controle de 19/11, escrito na véspera para ser lido, não montado. Main de referência: `5be00cc`.

**Entradas da quarentena com dono Code 2**

| Item | Spec | Estado | Onde | Prazo |
|---|---|---|---|---|
| E1011 | t29 | correção do teste pronta (pacote de refresco ensaiado sobre a main) | PR #3974 (verde) | na vez dele |
| E1023 | t70 caso 2 | correção do produto pronta (pacote de refresco ensaiado) | PR #3965 (verde) | na vez dele |
| E1019 | t1629 | diagnóstico na main desde `be31251d2`. A corrida agendada da main (cron 06:00 UTC) ainda não rodou depois dele; vigia armada | main | **plano ou correção até 21/11**; sem corrida até 20/11, peço ao Gerente um disparo manual da main |
| E13 | t442 (spec inteira, entrou com o #3986) | correção pronta: link "Problema com isto?" direto ao atendimento, casos 4 e 5 com estado próprio, a entrada sai | PR #3988 (+ t441, mesma causa) | antes de 26/11 |

**Já resolvidos e fora da quarentena:**
- E1010: #3979;
- E1012: #3981;
- E1014: #3969;
- E1015: #3977;
- E1016: #3978;
- E1020: #3982;
- E1017: fatias de 1 worker, #3960.

**`test.fail()` na parte do Code 2: zero.** Nenhuma falha determinística sem correção; tudo o que resta é intermitente com correção escrita ou com data.

**Lista cruzada do #3964 nas áreas do Code 2:**
- lotes A, B e C, t1645, t840, t741: já na main;
- E985 (t400, t456, t548): correção no #3898. O pacote de refresco está ensaiado já com o #3987 junto: o conflito em `salvo-fantasma.ts` e `novo/page.tsx` é mecânico e mantém as duas mudanças;
- E1023 (t70): #3965.

**Renovação de validade (01/12):** nenhuma pedida.

### Lista cruzada do marco: falhas novas da corrida 44307724189 (ORDEM-DUET-113, dono Code 2)

| Spec | Falha | Causa | Disposição | Correção |
|---|---|---|---|---|
| `t839-e524-cartao-mapa-no-pin` (E524) | estouro de 180 s a 390 px (fatia 20) | teste velho frente ao E988: os pins agrupados no "+N" trocam de testid quando o mapa anda; o laço contava os pins uma vez e andava pelo índice (`nth(17)` deixava de existir). Reproduzido no lab só com o spec (27 imóveis): 1280 em 6 s, 390 estoura | teste velho | este PR: o laço anda pelo id do pin da vista inicial; 6/6 no lab (390 em ~42 s) |
| `t692-e259-pagina-publica` (E259) | 390: `galeria-tile-0 img` não achada; 1280: instável (fatia 18) | as fotos do `criarImovelPronto` apontam para um endereço que não carrega; depois da 2ª tentativa o `BrandImage` troca o `<img>` por "Foto indisponível", e o teste só passava quando lia antes da troca | teste velho | este PR: `fotosReais` + a primeira foto tem de estar `pronta`; sem as fotos reais a asserção falha 1/1 (`Received: "falhou"`), com elas 10/10 |
