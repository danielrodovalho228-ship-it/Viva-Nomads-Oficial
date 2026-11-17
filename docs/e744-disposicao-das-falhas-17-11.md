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
