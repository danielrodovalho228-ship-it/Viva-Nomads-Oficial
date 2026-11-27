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

### corrigidoPor das disposições do Code 2 (ORDEM-DUET-118, 18/11)

Decisão do Gerente: as disposições sem `corrigidoPor` não contam para o marco de 19/11, e quem as preenche é o dono.
As 40 disposições `teste-velho` do pacote C2-SUITE em `tests/laboratorio/disposicao-falhas.json` ganharam o commit que as corrige na main.
O valor é o commit de merge do PR, com 8 caracteres, como a guarda e744-t1 exige.

| PR | corrigidoPor | Specs |
|---|---|---|
| #3847 | `a170b899` | 12: t38-varios-imoveis-por-dono, t64-telas-largas, t77-comodidades, t79-privacidade-acesso, t328-documento-sem-trava-l11, t331-preferencias-push-44b2, t346-importar-calendario-53, t370-conta-a3-papeis, t405-perfil-e60-e62, t464-prop6-inicio-dono, t465-admin4-inicial, t469-e134-passo4-alinhado |
| #3843 | `cc53b94d` | 14: t161-coerencia-imovel, t195-matricula-caf, t228-contato-vai-para-ajuda, t386-cadastro-01-tipo, t401-cadastro-10-revisao, t435-cadastro-03-endereco, t547-e148a-texto-sugerido-passo7, t564-e193-qualificacao-cartoes, t585-e205b-emails-novos, t656-e224-plano-gestor, t678-e202-emails-candidatura, t696-varredura-bloco74, t735-e277-busca-parceiros-fotos, t772-e329-visita-confirmada |
| #3849 | `38836c33` | 13: t186-cadastro-5-etapas, t204-cadastro-ia-real, t534-e147-bairro-santa-monica, t597-e213b-limpeza-renovacao, t621-varredura-bloco55, t655-observador-botoes-filas, t683-e259-perto-fonte-unica, t693-prova-de-publicacao, t778-e347-x-visita-video, t799-cadastro-regras-icones, t800-cadastro-passo4-titulo, t816-cidade-bairros-grade-par, t909-reembolso-linha-tablet |
| #3961 | `08231fd7` | 1: t1645-reprovas-e916-e915-e887-e931 |

39 + 1 = 40 preenchidas agora. O t741, também do #3961, já tinha o `corrigidoPor` na main e não mudou.

O t1645 não trazia `pr` no arquivo. A correção dele (161d8388d, o localizador aceita os 2 links do E941) entrou pelo #3961, no merge `08231fd7`.
Os quatro commits estão na main.
Ficam de fora as disposições do Code 2 que não são `teste-velho`: 11 `instavel` (quarentena; a guarda e744-t2 proíbe `corrigidoPor` nelas) e 5 `defeito` com PR. Essas seguem o caminho da tabela acima.

### Censo das fatias 8, 9 e 15 da corrida completa 44333898865 (ORDEM-DUET-120, 18/11)

Corrida agendada de 18/11 sobre a main `94e5035`. Caíram as mesmas três fatias da corrida 44307724189, mais o `consolidar`, por consequência.
Todas as falhas já têm disposição em `disposicao-falhas.json`. Nenhuma é da área do Code 2.

| Fatia | Spec | Falhas | Casos | Disposição no arquivo | Dono | Disposição proposta |
|---|---|---|---|---|---|---|
| 8 | `t245-visual-regressao` | 36 | as 18 telas × 2 larguras | teste-velho, #3908 | Fable | mantém: o #3908 (aberto) refaz as referências |
| 9 | `t271-admin-visual` | 11 | 1280: /admin, financeiro, documentos, atendimento, parceiros, contratos, contratos/[id], usuarios; 390: /admin, documentos, atendimento | teste-velho, #3908 | Fable | mantém (eram 10 na 44307724189; +1 tela, mesma causa: máscaras do admin) |
| 9 | `t263-visual-41` | 6 | 01 página do imóvel inteira (ube-001) ×2, 02 barra inferior (inquilino) ×2, 03 barra inferior (proprietário), 04 barra inferior (parceiro) 390 px | teste-velho, #3908 | Fable | mantém |
| 15 | `t50-rls-todas-tabelas` | 2 | anon em `imovel_extras`, anon em `property_amenities` | teste-velho, #3935 | Fable | o #3935 já entrou na main (`9e17a68e`), depois da `94e5035`. Falta a dona preencher `corrigidoPor: "9e17a68e"`. |

Total: 55 falhas, 4 specs, todas da Fable. As fatias 8 e 9 seguem vermelhas até o #3908 entrar. A fatia 15 deve ficar verde na próxima corrida.

Quarentena da mesma corrida: 15/15 (5 casos × 3, `--workers=1 --repeat-each=3`), com o t1629 E916 (E1019) 3/3. É a **2ª corrida verde seguida da quarentena** para o E1019, depois da 44307724189. Pelo critério aceite, falta uma para o PR de saída.

### E1019: tentativa com CPU estrangulada (critério 3 do plano; feita em 18/11, prazo era 20/11)

O caso "E916 a 404 tem o rodapé do site e a busca" do t1629 foi rodado com os mesmos passos e as mesmas esperas do spec, incluindo a linha de diagnóstico, contra a build de produção da main `cf25545` no laboratório local.
A CPU do navegador foi estrangulada pelo DevTools (`Emulation.setCPUThrottlingRate`).

| Variante | Rodadas | Passaram | Perdeu antes do clique | Perdeu depois do clique | Tempo médio (máx.) |
|---|---|---|---|---|---|
| 6×, uma página por vez | 20 | 20 | 0 | 0 | 3,0 s |
| 8×, uma página por vez | 20 | 20 | 0 | 0 | 3,9 s |
| 8×, 6 páginas em paralelo | 30 | 30 | 0 | 0 | 4,8 s (6,1 s) |
| 20×, 6 páginas em paralelo | 30 | 30 | 0 | 0 | 10,5 s (13,2 s) |

**Resultado: 100/100. Não reproduz.**
- Mesmo com a CPU 20 vezes mais lenta e 6 páginas ao mesmo tempo, o campo fica com "Uberlândia" depois do `fill` e a URL chega com `?local=Uberl`.
- Somando os 38/38 de antes, são 138 tentativas locais sem falha.
- Leitura: só a lentidão do navegador não basta para o defeito aparecer. Fica o que a corrida completa tem e o laboratório local não: o servidor sob a carga de 240 testes e a ordem dos testes na fatia geral.

**O que segue, sem mudança no plano:**
- A quarentena já deu duas corridas verdes seguidas: a 44307724189 e a 44333898865, ambas 3/3.
- Com mais uma verde, abro o PR de saída mantendo a linha de diagnóstico.
- Se uma corrida falhar, a linha separa "perdeu antes do clique" de "perdeu depois", e a correção vai à causa, com trava vermelha.
- Scripts da tentativa (fora do repositório): `e1019-cpu.cjs` e `e1019-cpu-par.cjs`.

### t707: corrigidoPor passa a ser o merge (ORDEM-DUET-123)

Decisão do Gerente: o t707 é do Code 2, e o `corrigidoPor` é sempre o commit de merge do PR.
O t707 (E987, #3911) apontava para o commit da correção (`adcde730`) e passa a apontar para o merge **`5861078e`**.
As outras 45 disposições do Code 2 com `corrigidoPor` já apontavam para merges (conferido com `git log --format=%P`).

### corrigidoPor das 8 instáveis que saíram da quarentena por PR (ORDEM-DUET-124/126)

Estas 8 instáveis do Code 2 saíram da quarentena por PR mesclado e ganham o `corrigidoPor`, que é o commit de merge desse PR (regra da ORDEM-123).
Também ganham o `pr`, quando faltava:

| Spec | Item | PR | corrigidoPor |
|---|---|---|---|
| t21-central-agentes | E1010 | #3979 | `e24cacf9` |
| t30-atendimento-autonomo | E1012 | #3981 | `51c75fae` |
| t108-admin-atendimento-status-humano | E1014 | #3969 | `1c22fadb` |
| t190-seo-robots-jsonld | E1015 | #3977 | `59bdf2ad` |
| t230-pagamento-sem-repeticao | E1020 | #3982 | `cbe9d4a4` |
| t305-laudo-avaliacao-62b2 | E1016 | #3978 | `a98d3385` |
| t321-video-alcancavel-65b | E1022 | #3966 | `d530a4b1` |
| t442-foto-perfil-revisao | E13 | #3988 | `07a2e9d3` |

Ficam sem `corrigidoPor`:
- t29 (E1011) e t1629 (E1019), que continuam na quarentena: a guarda e744-t2 proíbe o campo ali.
- t646 (E1017), que é tratado pela etiqueta `@sensivel-carga` (mitigação, não correção).
