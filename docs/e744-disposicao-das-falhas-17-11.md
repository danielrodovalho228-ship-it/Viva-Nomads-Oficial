# E744 — disposição das falhas da suíte completa (T1 do plano de 17/11)

**Base:** a última corrida completa do laboratório, a manual de 17/11 que terminou às 12:21 UTC (run [44070223214](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/44070223214), ramo do lote Admin do Code 2 = main `46b54f96` + 3 specs novos). Ela teve **82 specs vermelhos, 125 casos** (118 falharam, 7 instáveis).

Um dos 82 (`t2131`) só existe no ramo que a corrida testou, não na main; fica fora. **Os outros 81 têm uma disposição cada**, e a lista que as ferramentas leem é `tests/laboratorio/disposicao-falhas.json`. Este documento é a mesma lista, para leitura.

## 1. Resumo

| Disposição | Specs | Fable | Code 2 |
|---|---|---|---|
| (a) teste velho | 61 | 21 | 40 |
| (b) defeito real | 10 | 2 | 8 |
| (c) instável | 10 | 2 | 8 |
| **Total** | **81** | **25** | **56** |

- **Sem disposição: nenhum** dos 81.
- **Nenhuma asserção foi afrouxada, nenhum teste foi pulado e o número de novas tentativas não mudou.** A marca de defeito não desliga o teste: ele roda e cobra a mesma regra.
- Dos 61 testes velhos, **60 já têm correção escrita**, em PR aberto ou já na main. Falta só a do `t1645`, que é nova (seção 3).

## 2. Achado sobre a completude

O plano parte de que "a completude fechou" nas corridas de 17/11. **Nas cinco corridas completas de hoje ela não fechou:** ficaram de 63 a 72 testes listados sem rodar em cada uma (66 na corrida-base: listados 4.811, executados 4.648, pulados de propósito 97).

| Corrida | Listados | Executados | Pulados de propósito | Não executados |
|---|---|---|---|---|
| 44021106318 | 4789 | 4618 | 104 | 67 |
| 44038091791 | 4805 | 4629 | 104 | 72 |
| 44055780373 | 4809 | 4643 | 103 | 63 |
| 44056800277 | 4811 | 4647 | 97 | 67 |
| 44070223214 | 4811 | 4648 | 97 | 66 |

Não é fatia perdida nem teto de tempo. São os testes que vêm **depois de uma falha dentro de um spec em série**: quando o caso 1 falha, o Playwright não começa os casos seguintes. O registro da corrida-base mostra os 50 primeiros dos 66: estão em 27 specs, todos da lista abaixo (por exemplo `t263` 7, `t464` 5, `t597` 4, `t204` 3). A completude fecha sozinha à medida que esses specs ficam verdes ou marcados; não é preciso mudar a regra.

## 3. (a) Teste velho

### 3.1 Na área da Fable (21 specs)

| Spec | Casos na corrida | Correção | Decisão citada |
|---|---|---|---|
| `t50-rls-todas-tabelas` | 2 falharam | #3935, draft | E1001: comodidades, extras e ruído do anúncio ativo são leitura pública |
| `t245-visual-regressao` | 19 falharam | #3908, draft | referências visuais julgadas pelo Gerente; E990 e E949 seguem marcados |
| `t263-visual-41` | 4 falharam | #3908, draft | referências visuais julgadas pelo Gerente; E990 e E949 seguem marcados |
| `t271-admin-visual` | 11 falharam | #3908, draft | referências visuais julgadas pelo Gerente; E990 e E949 seguem marcados |
| `t318-papel-ativo-fonte-unica` | 1 falhou | #3846, draft | E548, E653: a página de outra área não grava o papel (passo 7) |
| `t353-varredura-bloco18` | 1 falhou | #3840, draft | E798: a Conta abre no destino registrado (passo 2) |
| `t385-varredura-bloco21` | 2 falharam | #3841, draft | E679, E798: as avaliações da Conta abrem no destino registrado (passo 3) |
| `t392-varredura-bloco24` | 4 falharam | #3841, draft | E679, E798: as avaliações da Conta abrem no destino registrado (passo 3) |
| `t407-varredura-bloco26` | 1 falhou | na main, `467172e1` | E1008: a régua "fixo" da varredura só acusa o que a rolagem não revela; já na main, depois da corrida |
| `t607-varredura-bloco51` | 1 falhou | #3840, draft | E798: a Conta abre no destino registrado (passo 2) |
| `t661-varredura-bloco62` | 1 falhou | #3840, draft | E798: a Conta abre no destino registrado (passo 2) |
| `t679-varredura-bloco70` | 1 falhou | #3841, draft | E679, E798: as avaliações da Conta abrem no destino registrado (passo 3) |
| `t694-varredura-bloco73` | 2 falharam | #3840, draft | E798: a Conta abre no destino registrado (passo 2) |
| `t838-varredura-matriz-bloqueadas` | 1 falhou | #3841, draft | E679, E798: as avaliações da Conta abrem no destino registrado (passo 3) |
| `t886-e464-cabecalho-conta` | 1 falhou | #3845, draft | E668: o papel de parceiro só vale com o carimbo da escolha (passo 6) |
| `t1402-varredura-bloco480` | 1 falhou | #3840, draft | E798: a Conta abre no destino registrado (passo 2) |
| `t1411-varredura-bloco489` | 1 falhou | #3841, draft | E679, E798: as avaliações da Conta abrem no destino registrado (passo 3) |
| `t1423-varredura-bloco497` | 1 falhou | #3840, draft | E798: a Conta abre no destino registrado (passo 2) |
| `t1439-varredura-bloco506` | 1 falhou | #3841, draft | E679, E798: as avaliações da Conta abrem no destino registrado (passo 3) |
| `t1448-varredura-bloco514` | 1 falhou | #3840, draft | E798: a Conta abre no destino registrado (passo 2) |
| `t1461-varredura-bloco523` | 1 falhou | #3841, draft | E679, E798: as avaliações da Conta abrem no destino registrado (passo 3) |

Todos estes PRs já existiam (o #3840, o #3841, o #3845 e o #3846 passaram pela T0 de hoje e seguem necessários). Nenhum está sobre a main de agora: atualizo cada um na vez dele.

### 3.2 Fora da área da Fable: pacote C2-SUITE (40 specs)

| Onde está a correção | Specs |
|---|---|
| #3843 (lote A, draft) | `t161-coerencia-imovel`, `t195-matricula-caf`, `t228-contato-vai-para-ajuda`, `t386-cadastro-01-tipo`, `t401-cadastro-10-revisao`, `t435-cadastro-03-endereco`, `t547-e148a-texto-sugerido-passo7`, `t564-e193-qualificacao-cartoes`, `t585-e205b-emails-novos`, `t656-e224-plano-gestor`, `t678-e202-emails-candidatura`, `t696-varredura-bloco74`, `t735-e277-busca-parceiros-fotos`, `t772-e329-visita-confirmada` |
| #3847 (lote B, draft) | `t38-varios-imoveis-por-dono`, `t64-telas-largas`, `t77-comodidades`, `t79-privacidade-acesso`, `t328-documento-sem-trava-l11`, `t331-preferencias-push-44b2`, `t346-importar-calendario-53`, `t370-conta-a3-papeis`, `t405-perfil-e60-e62`, `t442-foto-perfil-revisao`, `t464-prop6-inicio-dono`, `t465-admin4-inicial`, `t469-e134-passo4-alinhado` |
| #3849 (lote C, draft) | `t186-cadastro-5-etapas`, `t204-cadastro-ia-real`, `t534-e147-bairro-santa-monica`, `t597-e213b-limpeza-renovacao`, `t621-varredura-bloco55`, `t655-observador-botoes-filas`, `t683-e259-perto-fonte-unica`, `t693-prova-de-publicacao`, `t778-e347-x-visita-video`, `t799-cadastro-regras-icones`, `t816-cidade-bairros-grade-par`, `t909-reembolso-linha-tablet` |
| **sem PR ainda** | `t1645-reprovas-e916-e915-e887-e931` |

**`t1645` é a única falha nova sem correção escrita.** Vermelha nas 3 últimas corridas e 6 de 6 no laboratório local (os dois tamanhos, 3 repetições, sem nova tentativa, main `c2ad73b9`). Causa: E941 (77762a39): a resposta da Ajuda ganhou um segundo link para /conferir, no próprio texto; o localizador do teste acha 2 e para. O teste está certo em cobrar o link; o que ficou velho é o localizador, que espera um link só. É da Ajuda (Família 6), fora da minha área: não mexi.

O `t656` também é alterado pelo meu #3882 (Prompt 078); quem entrar depois resolve a junção. O `t204` está no lote C como teste velho: a causa de produto que ele achou (soltar fotos durante um envio apaga o lote anterior) é o E989, no #3900.

## 4. (b) Defeito real (10 specs)

| Spec | Caso que falha | Item | Correção | Marca |
|---|---|---|---|---|
| `t11-travessias` | o dono vê o pedido, mas nunca o e-mail/sobrenome do inquilino | E975 | #3888 (Code 2) | sim |
| `t316-sair-da-viva-51` | 3. regra dos 3 em 30 dias | E982 | #3906 (Code 2) | não: corrigido na main (`ea947736`) |
| `t348-triagem-vinculo-52` | 2. o dono vê o selo só com identidade + vínculo | E961 | #3857 (Fable) | sim |
| `t397-foto-na-hora` | 5. prova anterior à regra | E984 | #3909 (Code 2) | não: corrigido na main (`ecdc95c8`) |
| `t400-chacara-sem-internet` | 1. salvar rascunho com 'Não tem internet'; 2. publicar barrado (depende do 1); 3. trocar para 'Fibra' | E985 | #3898 (Code 2) | sim, 3 casos |
| `t456-comodidades-tipo-e111a` | 2. troca de tipo: o elevador marcado fica salvo | E985 | #3898 (Code 2) | sim |
| `t548-e132a-declaracoes-persistem` | 2. o que se marca no Passo 10 fica no rascunho, a 1280 e a 390 px | E985 | #3898 (Code 2) | sim, 2 casos |
| `t707-e262-galeria-destaques-previa` | (a) 1280 px: abertura fria e "Próxima foto" (a 390 px passa) | E987 | #3911 (Code 2) | sim |
| `t815-404-perfil-toque` | 404: logo e link de anunciar com 44 px | E960 | #3855 (Fable) | sim |
| `t840-e525-pins-sem-sobreposicao` | pins sem sobreposição | E988 | #3912 (Code 2) | não: a falha depende dos pins que outros testes deixam no mesmo ponto do mapa: muda de largura e de passo conforme a fatia; a trava nomeada do item é o t2108 (#3936) |

**Como a marca funciona.** `defeitoConhecido("E975", "motivo")` é o `test.fail()` com a anotação `{ type: "defeito", description: "E975" }`. O teste roda inteiro; a falha passa a ser a esperada e a rodada conta "conhecida", não "falhou". No dia em que a correção entrar, o teste passa, o Playwright acusa "era para falhar e passou" e a rodada fica vermelha até a marca sair. **Por isso cada PR de correção da tabela tem de tirar a marca do spec dele** (uma linha e o import).

**O que a marca mostrou nos specs em série.** Cinco dos sete specs marcados são em série: quando um caso falha, o Playwright nem começa os seguintes, e eles entram na conta dos "não executados". Com a marca no caso que falha, os seguintes passaram a rodar. No laboratório local, quatro deles falharam, todos pelo mesmo defeito do spec, e levaram a mesma marca:

- `t397`, caso 6 (rotina dos prazos): dependia do caso 5, que parava antes de vencer o prazo da prova. O #3909 corrigiu o E984 na main em 17/11 e as duas marcas do `t397` saíram; os casos 5 e 6 passam;
- `t400`, caso 2: depende do rascunho que o caso 1 não consegue gravar; caso 3: é o mesmo defeito, direto (escolhe "Fibra" e o rascunho fica com o valor antigo);
- `t548`, caso 2 a 390 px: o mesmo defeito do caso a 1280 px. Nas corridas ele nunca tinha começado.

Os outros seguintes passaram (`t456` caso 3, `t707` os cinco depois do primeiro). Ficam 9 marcas em 7 specs. O `t11` e o `t815` não são em série.

**Limite.** O #3898 (E985) não nomeia o `t400`, o `t456` nem o `t548`. Se depois dele algum seguir falhando, a marca fica e o item continua aberto para esse spec.

## 5. (c) Instável (10 specs)

Regra do plano: um teste com 2 instabilidades em rodadas diferentes vira item de instabilidade com dono. Olhei as 7 corridas completas de 16 e 17/11. Os 10 abaixo passam da regra; usei os números livres a partir de E1010.

| Spec | Item | Dono | Nas 7 corridas | O que se vê | Vai para |
|---|---|---|---|---|---|
| `t21-central-agentes` | E1010 | Code 2 | vermelho em 0, instável em 4 | o passo do gerente não aparece na primeira tentativa | quarentena (T2) |
| `t29-chat-sem-aprovacao` | E1011 | Code 2 | vermelho em 0, instável em 7 | a contagem esperada 0 vem 1 na primeira tentativa | quarentena (T2) |
| `t30-atendimento-autonomo` | E1012 | Code 2 | vermelho em 1, instável em 3 | a frase "Resposta automática da Viva…" não aparece a tempo | quarentena (T2) |
| `t48-varredura` | E1013 | Fable | vermelho em 0, instável em 7 | estoura os 30 minutos na primeira tentativa e passa na segunda | correção na T3: o teste leva de 25 a mais de 30 minutos e o teto dele é 30; 3 repetições não cabem no job da quarentena |
| `t108-admin-atendimento-status-humano` | E1014 | Code 2 | vermelho em 0, instável em 3 | estoura os 90 s na primeira tentativa | quarentena (T2) |
| `t190-seo-robots-jsonld` | E1015 | Code 2 | vermelho em 0, instável em 7 | "Unexpected end of JSON input" na primeira tentativa | quarentena (T2) |
| `t305-laudo-avaliacao-62b2` | E1016 | Code 2 | vermelho em 0, instável em 7 | o texto "novo pedido, avaliador à sua escolha" não aparece na primeira tentativa | quarentena (T2) |
| `t646-cadastro-titulo-nao-pula` | E1017 | Code 2 | vermelho em 2, instável em 0 | o "Salvo" não aparece em 20 s; sozinho passa 10 de 10 | T3: etiqueta de sensível à carga, fatia própria com 1 worker |
| `t776-e340-menu-parceiro-secao` | E1018 | Fable | vermelho em 2, instável em 1 | a aba acesa não é a da seção visível; sozinho passa 6 de 6 | quarentena (T2) |
| `t1629-familia2-rotas-vivas` | E1019 | Code 2 | vermelho em 0, instável em 7 | a busca da 404 cai em /buscar sem o ?local= na primeira tentativa | quarentena (T2) |

Cinco deles (`t29`, `t48`, `t190`, `t305`, `t1629`) foram instáveis **nas 7 corridas**: falham sempre na primeira tentativa e passam sempre na segunda. Isso não parece acaso; parece dependência de ordem ou de estado frio, e deve ter causa única em cada um. Fica dito para o dono de cada item.

## 6. Fora desta lista

- **`t2131`** (aviso do LinkedIn): vermelho na corrida, mas só existe no ramo do lote Admin (#3955). É do Code 2.
- **Intermitentes que não estavam vermelhos na corrida-base:** `t194` (3 das 7 corridas, sensível à carga, entra na T3 com o `t646`); `t115`, `t230`, `t241`, `t255`, `t291`, `t404`, `t1458` e `t1612` (1 corrida cada: ainda não passam da regra das 2).
- **Vermelhos em corridas anteriores e verdes na corrida-base, ainda com correção à espera:** `t198` (#3934), `t279`, `t352` e `t354` (#3840) e `t355` (#3910). Falham em umas corridas e não em outras; não dei disposição nova porque a que têm continua valendo.
- **Pacote E1008 + E1009** (entrou na main depois da corrida-base): cobre `t407`, `t412`, `t1409` e `t1442`. A confirmação vem na primeira corrida completa sobre a main de agora.

## 7. Como foi feito e o que não foi

- A tabela vem dos registros dos 20 jobs da corrida-base (linhas `FALHA | …`), cruzada com a classificação de 15/11 (`docs/e744-classificacao-96-specs.md`), a re-triagem de 17/11 e os arquivos de cada PR aberto.
- Os 10 defeitos e o `t1645` correram no laboratório local na main `c2ad73b9`, cada spec sozinho, 3 repetições, sem nova tentativa: todos falharam nas 3. O `t316` e o `t397` foram corrigidos na main logo depois (#3906 e #3909).
- **Não conferi** os 40 specs do Code 2 um a um: a disposição deles é a da tabela de 15/11 e o PR do lote que altera cada spec.
- Com as marcas, os 7 specs marcados, o `t316` e o `t397` correram no laboratório local na main `ecdc95c8`, como o CI roda (2 workers, 1 nova tentativa, instável reprova). O resultado está no PR.
- **Não rodei** a suíte completa com as marcas: é a prova real do plano, depois da T1 à T4.

## 8. Acrescentados pela corrida de prova (17/11, à noite)

A corrida completa com a T1, a T2 e a T3 juntas (run 44114328109, commit `d67b2b8d`, 1 worker, 20 fatias gerais) mostrou 8 specs que não estavam na lista. Não estavam vermelhos na corrida-base; a troca de ordem das fatias os trouxe à tona. Cada um ganhou disposição e, menos o `t741`, entrou na quarentena formal, por decisão do Gerente (DUET-1219 e DUET-1225).

| Spec | Disposição | Item | Dono | Correção | O que se viu |
|---|---|---|---|---|---|
| `t230-pagamento-sem-repeticao` | instável | E1020 | Code 2 | ainda não há | caso 1 (Caução do contrato, clique duplo) instável em 2 corridas |
| `t321-video-alcancavel-65b` | instável | E1022 | Code 2 | ainda não há | caso 1 (envio do vídeo) instável na corrida de prova: primeira ocorrência |
| `t198-rodape-painel-390` | teste velho | E1000 | Fable | #3934 | mede antes de a Conta assentar |
| `t279-varredura-logada` | teste velho | E1021 | Fable | #3840 | a varredura cobra `/dashboard/conta`; a Conta abre no destino registrado |
| `t352-varredura-bloco17` | teste velho | E1021 | Fable | #3840 | a mesma |
| `t354-varredura-bloco19` | teste velho | E1021 | Fable | #3840 | a mesma |
| `t800-cadastro-passo4-titulo` | teste velho | E744 | Code 2 | #3849 (lote C) | depende da ordem: usa a conta compartilhada |
| `t741-e288b-trafego-de-teste` | teste velho | E744 | Code 2 | #3961 (C2-SUITE), já na main (`08231fd7`) | o spec não limpava o limite de 300 eventos por hora antes de correr. A correção entrou antes deste registro: **não foi para a quarentena** |

Duas regras novas da quarentena saíram daqui:

- **Teste velho com correção escrita entra apontando o PR** (campo `correcao`) e sai quando o PR for mesclado. Quem tira a entrada é o próprio PR da correção.
- **Cadeia em série entra inteira** (campo `cadeiaDe`). O `t230` e o `t321` rodam em série e os casos seguintes dependem do caso 1: com só o caso 1 em quarentena, as fatias gerais ficaram vermelhas na prova local (o caso 3 do `t230` espera a Caução que o caso 1 registra; o caso 2 do `t321` espera o vídeo que o caso 1 envia). Por isso os 3 casos do `t230` e os 5 do `t321` estão na quarentena.

Com isso a quarentena fica em **23 de 25**. Sete entradas saem quando as três correções (#3934, #3840 e #3849) entrarem.

O `t840` (E988) foi corrigido na main pelo #3912 (`d5e682a8`), depois da corrida de prova.

O `t70`, caso 2 (hover no pin da busca), falhou uma vez na fatia 18 e passa 18 de 18 sozinho. Ganhou disposição depois (DUET-1319: toda falha da corrida de prova tem disposição): **defeito, E1023, Code 2**. A causa foi reproduzida no laboratório local. Passar o mouse num pin abre o cartão do imóvel; quando o cartão não cabe acima do pin, o mapa anda para ele caber, o cartão fica por cima do ponteiro e o pin perde o hover. O pin continua aceso (o cartão está aberto), mas o card da lista perde o destaque. No laboratório local isso acontece em 1 ou 2 de cada 24 pins; o teste escolhe o último pin livre, que muda conforme os imóveis que os outros testes deixam. **Sem marca de falha conhecida:** tentei uma marca que só valia com o cartão por cima do ponteiro; na prova local ela acertou 2 de 3 repetições e na terceira o teste passou (o card recuperou o destaque dentro da espera), o que deixaria a noite vermelha pelo motivo errado. Decisão de produto do Gerente (DUET-1349): o card da lista mantém o destaque enquanto o cartão do imóvel está aberto no mapa; perder o destaque é o defeito. Ainda não há PR de correção. **Entrou na quarentena** (DUET-1419: defeito registrado, com dono e correção a caminho, cuja falha não é sempre a mesma); o PR da correção do E1023 tira a entrada.

## 9. Intermitentes achados fora de corrida completa (18/11, ORDEM-DUET-096)

Dois testes falharam às vezes nos vizinhos do #3983 (E1025). Rodados sozinhos contra a main `b4b0bc71`, 3 vezes cada, falharam do mesmo jeito: não vieram de PR nenhum. O Gerente mandou os dois para a quarentena como intermitentes, com correção ou plano do dono até 26/11.

| Spec | Caso | Sozinho contra a main | Item | Dono | Na quarentena |
|---|---|---|---|---|---|
| `t355-conta-a-perfil-espelho` | 5, a 1280 px | 2 falhas em 3: o endereço fica com `#perfil-publico` | E61 | Fable | o caso, apontando a correção escrita (#3910) |
| `t442-foto-perfil-revisao` | 4 (e o 5, que depende dele) | 1 falha em 3: o teste espera `/ajuda?contexto=perfil…` e a página já seguiu para `/ajuda/fale-com-a-viva` | E13 | Code 2 | o spec inteiro, numa entrada só, com os casos 4 e 5 nomeados |

- O `t442` já estava nesta lista como teste velho (caso 3, corrigido pelo #3847); a disposição dele passa a instável.
- **Entrada de spec inteira (ORDEM-DUET-097):** os casos 4 e 5 do `t442` dependem dos casos 1 a 3. Em vez de partir a cadeia, uma entrada cobre o arquivo todo: as fatias gerais ficam sem ele e o job da quarentena roda-o com a cadeia intacta. A dependência entre casos faz parte do que o dono resolve até 26/11. O `t355` fica ao nível do caso, porque o caso 5 roda sozinho.
- O `t355` entra pela chave `foraDeCorrida` do arquivo: não estava vermelho na corrida-base nem na de prova.
- O #3910 não entra enquanto a disposição do `t355` não fechar.
- Se os dois aparecerem nas falhas da corrida completa de 18/11 sobre a main `6bfa3816`, contam contra este diagnóstico, não como falha nova.

## 10. Registo: `corrigidoPor` do E960 e do E961 pelo commit do merge (19/11, ORDEM-DUET-161/163)

O #3855 (E960, `t815`) e o #3857 (E961, `t348`) tiraram a marca de defeito conhecido e, por isso, tiveram de gravar o `corrigidoPor` dentro do próprio PR, antes de o merge existir: entraram com o commit do ramo. Por decisão do Gerente (ORDEM-DUET-122), o `corrigidoPor` é o commit do **merge** do PR na main. Este registo troca os dois.

| Spec | Item | PR | Antes (commit do ramo) | Agora (commit do merge na main) |
|---|---|---|---|---|
| `t815-404-perfil-toque.spec.ts` | E960 | #3855 | `4f64224d` | `44c82ddc` |
| `t348-triagem-vinculo-52.spec.ts` | E961 | #3857 | `9ca1fe90` | `52d0be56` |

Só dados: nenhuma guarda mudou e nenhum spec mudou.

## 11. Defeitos achados e corrigidos depois da corrida-base: E1034 e E1035 (19/11, ORDEM-DUET-181/182)

Dois defeitos do editor de anúncios, da mesma família (o rascunho cuja linha tem as colunas e as fotos mas não tem `draft_data`), entraram e saíram no mesmo dia. Nenhum cabia nas listas deste arquivo, por isso entram num campo próprio do cabeçalho, `corrigidosDepois`.

| Spec | Item | De onde veio | O defeito | PR | `corrigidoPor` |
|---|---|---|---|---|---|
| `t296-niveis-exibicao-59-1` (caso 5) | E1034 | vermelho na corrida manual completa 44495944766 (main `1c00bcb9`) | abrir o rascunho regravava a linha vazia e apagava as fotos; regressão do #4004 (E614) | #4015 | `8e57ae18` |
| `t1697-e1035-editar-rascunho-sem-dados-preserva-o-resto` | E1035 | trava nova; o defeito foi achado por leitura do código (Dúvida 1 do #4015) e a trava ficou vermelha contra a main `8e57ae18` | editar um campo gravava o formulário por cima do resto da linha e apagava as fotos; anterior ao #4004 | #4017 | `b0814b68` |

Os dois specs não levam `defeitoConhecido`: a correção já está na main. O `corrigidoPor` é o commit do merge (ORDEM-DUET-122).

**Asserção alterada na guarda (`e744-t1-disposicao-das-falhas.test.ts`), por decisão do Gerente (ORDEM-DUET-181 e 182):** a conta das disposições era corrida-base + corrida de prova + fora de corrida (91); passa a somar os `corrigidosDepois` (93). Cada um destes tem de ser `defeito`, com item, PR, o commit do merge e a origem. Nada foi retirado nem afrouxado para as 91 entradas que já existiam.

Na mesma corrida 44495944766 falhou também o `t271` a 390 px em `/admin/atendimento`. Não entra aqui: a disposição dele (teste velho, #3908) não muda; a causa foi o estado da fila no banco da fatia, não um defeito (ORDEM-DUET-175).

## 12. Registo: travas novas de 19/11 e o merge que as pôs na main (ORDEM-DUET-180/181)

Conteúdo da Pista 3, trazido pelo Gerente (ORDEM-DUET-182).

Travas que nasceram com a correção e nunca foram vermelhas numa corrida completa: não têm disposição em
`disposicao-falhas.json`. Fica aqui o commit do **merge** de cada uma (ORDEM-DUET-122), para a leitura das corridas.

| Spec | Item | PR | Commit do merge na main |
|---|---|---|---|
| `t1694-e1031-admin-sem-pre-carregar-a-saida.spec.ts` | E1031 | #4010 | `9955704b` |
| `t1696-e1034-abrir-rascunho-sem-dados-nao-regrava.spec.ts` | E1034 | #4015 | `8e57ae18` |

Esta anotação é só dados: não mexe em guarda nem em spec.

## 13. Registo da Conta: o `t355` sai da quarentena e 19 `corrigidoPor` em falta (24/11, ORDEM-DUET-617 e 619)

**O `t355` saiu da quarentena.** A correção (#3910, E61) está na main: a âncora antiga do próprio Perfil sai do endereço, e os dois caminhos do link antigo `/dashboard/conta#perfil-publico` terminam no mesmo endereço. A entrada do caso 5 foi tirada de `quarentena.json` e a disposição ganhou o `corrigidoPor` `22e049ed`, o commit do merge do #3910. A disposição foi **correção** (decidida no corpo do #3910): com a mesma repetição do caso, a main sem a correção deu 3 falhas, 1 instável e 2 verdes em 6; com a correção, 6 verdes em 6.

**A guarda dos achados fora de corrida mudou** (asserção alterada; desenho na ORDEM-DUET-103, decisão 3; aprovada na ORDEM-DUET-246). Antes: o achado tinha de estar sempre na quarentena, e a guarda reprovava quando a correção tirava a entrada. Agora: está na quarentena **ou** tem a correção registrada (`corrigidoPor`); nunca as duas coisas, nem nenhuma.

**`corrigidoPor` em falta na Conta: 19 disposições.** São testes velhos da reforma da Conta (E744) cujo PR já estava na main e que ainda apareciam como abertos. O valor é o commit do **merge do PR na main** (ORDEM-DUET-122).

| PR | Disposições | `corrigidoPor` |
|---|---|---|
| #3934 | 1: `t198` | `a536f2f4` |
| #3840 | 10: `t279`, `t352`, `t353`, `t354`, `t607`, `t661`, `t694`, `t1402`, `t1423`, `t1448` | `cace1911` |
| #3841 | 7: `t385`, `t392`, `t679`, `t838`, `t1411`, `t1439`, `t1461` | `23bab36f` |
| #3845 | 1: `t886` | `432df5f8` |

Com este registo, 79 das 93 disposições têm `corrigidoPor`.

**O que este registo não leva** (decisão do Gerente, ORDEM-DUET-619: este registo é só da Conta): o `t50` (#3935), o `t245`, o `t263` e o `t271` (#3908) e o `t318` (#3846), que têm o PR na main e continuam sem `corrigidoPor`; a troca do `t407` (do commit do ramo para o do merge do #3953); o `t48` (#3959); o `t400` (#3898, do Code 2); e a disposição nova do `t2157` (E1047, #4052). Nenhum é da Conta: ficam para o registo das linhas deles.
