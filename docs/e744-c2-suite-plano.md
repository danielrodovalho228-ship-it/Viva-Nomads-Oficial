# Pacote C2-SUITE — plano (17/11; o #3956 entrou na main em 3fed3b9c)

Fonte: `tests/laboratorio/disposicao-falhas.json` e `docs/e744-disposicao-das-falhas-17-11.md` do #3956 (head 04fc8b781).
Corrida-base: run 44070223214, main 46b54f96, 82 specs / 125 casos. Dono "Code 2": 56 specs (40 teste-velho, 8 defeito, 8 instável).

## A. Teste velho — 40 specs, correção já escrita em 3 lotes (todos draft, nenhum sobre a main de agora)
| Ordem | PR | Specs |
|---|---|---|
| 1 | #3843 lote A (14) | t161, t195, t228, t386, t401, t435, t547, t564, t585, t656, t678, t696, t735, t772 |
| 2 | #3847 lote B (13) | t38, t64, t77, t79, t328, t331, t346, t370, t405, t442, t464, t465, t469 |
| 3 | #3849 lote C (12) | t186, t204, t534, t597, t621, t655, t683, t693, t778, t799, t816, t909 |
| 4 | **novo PR C2-SUITE** (1) | t1645 — localizador espera 1 link para /conferir; depois do E941 (77762a39) a resposta tem 2. Escopo: só o localizador (`.first()` ou filtro pelo link do botão), asserção inalterada. A Fable disse que é Família 6/Ajuda = Code 2 (E941 foi meu). |

Cada lote: refresh sobre a main do momento → spec(s) do lote sozinho(s) no lab, 2 larguras, sem retry → verify + lab-crítico → pronto para QA.
Juntas conhecidas: t656 também mexido pelo #3882 (Prompt 078); t204 depende do E989 (#3900).

## B. Defeito — 8 specs, já com PR próprio
| Spec | Item | PR | Estado |
|---|---|---|---|
| t11 | E975 | #3888 | draft, aberto |
| t316 | E982 | #3906 | mergeado (ea947736) |
| t397 | E984 | #3909 | mergeado (ecdc95c8) |
| t400, t456, t548 | E985 | #3898 | draft, aberto |
| t707 | E987 | #3911 | mergeado (5861078e); marca tirada no próprio PR |
| t840 | E988 | #3912 (+ trava t2108 no #3936) | depois da T2 (#3957) e da T3 (#3960) |

Nada novo a escrever; só a vez de cada um na cadeia.

## C. Instável — 8 specs (T2 quarentena / T3 carga), itens novos E1010–E1019
| Spec | Item | Sintoma (1ª tentativa) | Destino |
|---|---|---|---|
| t21 | E1010 | passo do gerente não aparece | quarentena |
| t29 | E1011 | contagem 0 vem 1 (7/7) | quarentena |
| t30 | E1012 | frase da resposta automática atrasa | quarentena |
| t108 | E1014 | estoura 90 s | quarentena |
| t190 | E1015 | "Unexpected end of JSON input" (7/7) | quarentena |
| t305 | E1016 | texto do novo pedido (7/7) | quarentena |
| t646 | E1017 | "Salvo" > 20 s; 10/10 sozinho | T3 fatia 1 worker |
| t1629 | E1019 | 404 cai em /buscar sem ?local= (7/7) | quarentena |

A quarentena/T3 é da T2/T3 do plano da Fable (não é minha). Minha parte: causa de cada item. Ordem proposta pelo "7/7 na 1ª tentativa" (causa única provável): t29, t190, t305, t1629, depois t21, t30, t108, t646.

## D. Fora da lista mas meu
- t2131 (aviso do LinkedIn): só existe no #3955 (Pista 3 · lote Admin) — confirmar dono antes de mexer.

## Ordem do pacote (depois do #3956 na main)
1. PR C2-SUITE com t1645 (único sem correção escrita) — teste nomeado: t1645 vermelho na main, verde no PR.
2. Lotes A → B → C, um por vez, refresh + gates.
3. Instáveis: um item por PR, na ordem acima, cada um com prova de 10/10 sem retry.

## Prova do t1645 (este PR) — lab local, main 3fed3b9c, sem nova tentativa
- main (antes): E887 vermelho nas 2 larguras — `strict mode violation: getByTestId('ajuda-perguntas').locator('a[href="/conferir"]') resolved to 2 elements`; os outros 6 casos verdes.
- PR (depois): `--repeat-each=3` → **24 passed** (8 casos × 3).
- Asserções alteradas: nenhuma. Localizador: `.first()` + contagem ≥ 1.
