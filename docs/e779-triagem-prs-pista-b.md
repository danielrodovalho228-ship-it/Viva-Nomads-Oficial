# E779 — triagem dos PRs abertos da Pista B (09/11/2026, durante a pausa de produção)

Foto do GitHub às ~11h35 UTC de 09/11 (main em `344e3a2`, vermelha só pelo teste do E727/E728 que o #3598 corrige).
Escopo: os 31 PRs abertos cuja branch começa por `claude-b/` entre os 200 PRs abertos mais recentes. Não li PRs de outras pistas.
Método: (1) conflito de cada PR contra a base e **de cada par de PRs entre si** com `git merge-tree` local; (2) checks do GitHub (`verify`, `lab-critico`, `e2e`) na última execução de cada PR; (3) leitura do diff dos PRs com sobreposição.
**Limite:** o campo "check" é o da última execução de cada PR, rodada contra a main **da época**; os verdes anteriores a 23:52 UTC de 08/11 foram testados antes da main quebrar (é exatamente o que o gate do E775 corrigiria). Não li o log de cada `verify` vermelho.

## Classes
- **M** = mergeável (limpo contra a base, checks verdes na última execução).
- **M\*** = mergeável depois de atualizar com a main que já tenha o #3598 (o `verify` vermelho é posterior à quebra da main; **causa provável: o drift do E727/E728**, não confirmada por log em todos).
- **D** = duplicado (outro PR faz a mesma mudança).
- **O** = obsoleto.
- **B** = bloqueado por outro PR (base empilhada).

## Relatório numerado
| # | PR | Item | Classe | Check | Observação |
|---|---|---|---|---|---|
| 1 | #3598 | fix(main): testes E727/E728 | **M (primeiro)** | verde | pronto (não é draft); desvermelha a main |
| 2 | #3602 | CLAUDE.md: finishing só PR | M\* | verify vermelho | só docs, então o vermelho é drift; pronto (não é draft) |
| 3 | #3464 | E293 r13 conferência | M | verde | |
| 4 | #3488 | E293 r14 estadia | M | verde | |
| 5 | #3491 | E293 r15 candidaturas | M | verde | |
| 6 | #3509 | E293 r16 triagem do vínculo | M | verde | |
| 7 | #3515 | Erros r17 (pedido de avaliação) | M | verde | **fica com este**; mais completo que o #3667 (mostra aviso em vez de lançar; cobre itens, laudo e fotos) |
| 8 | #3516 | Erros r18 (dono nas provas) | **D** de #3593 | verde | mesma mudança em `prova-actions.ts` que o 3º item do #3593; **conflitam entre si**. Manter o #3593 (superconjunto) e fechar o #3516 |
| 9 | #3528 | Erros r19 (renovação, pets) | M | verde | acrescenta ao fim de `docs/e293-auditoria-retencao.md` |
| 10 | #3529 | Erros r20 (agenda, instruções, código) | M | verde | idem |
| 11 | #3524 | E690 ativação automática do avaliador (migração 0335) | M | verde | tem migração: aplica a Action na hora do merge; atrás de chave |
| 12 | #3531 | E742 proximidades | M | verde | |
| 13 | #3532 | E743 selo do laudo | M | verde | depois dele a Pista C tira o `test.fail` do t1429 |
| 14 | #3534 | E745 doc do backup | M | verde | só docs |
| 15 | #3545 | E256 doc da porta de QA | M | verde | só docs |
| 16 | #3573 | E766 backup no /admin | M | verde | |
| 17 | #3580 | E751 imagem lisa | M | verde | base é main antiga; verde de antes da quebra; Pista C tem spec sobre ele (#3591) |
| 18 | #3579 | E752 caução | M | verde | **base do #3596**; entra antes dele |
| 19 | #3596 | E776 textos-fonte + gate | **B** (#3579) | verde | trocar a base para a main depois do #3579 |
| 20 | #3588 | E744 suíte fatiada | M | verde (5/5 antes do reverso; ver nota) | base do #3597; o `lab-critico` ficou vermelho depois de um commit meu que alterava o t48, **revertido** (`129a6d735`); precisa rodar de novo |
| 21 | #3597 | E775 gate de leitura | **B** (#3588) | verde | |
| 22 | #3612 | E768 fotos do detalhe | M | verde | |
| 23 | #3593 | Erros r21 | M\* | verify vermelho | superconjunto do #3516 (3º item) |
| 24 | #3594 | E293 relatório 08/11 | M\* | verify vermelho | complementar ao #3655 (descrições do inventário); não é obsoleto |
| 25 | #3595 | E705 apagar rascunho e fotos do draft | M\* | verify vermelho | código; **causa do vermelho não lida**: pode ser dele, não só drift. Reconferir após atualizar |
| 26 | #3637 | E778 evidência Superpowers | M\* | verify vermelho | só docs |
| 27 | #3641 | E755 nota do mecanismo | M\* | verify vermelho | só docs |
| 28 | #3655 | E293 inventário `contratos` + §11/§12 | M | verde (reparado) | acrescenta ao fim do mesmo arquivo dos #3515/#3516/#3528/#3529 |
| 29 | #3667 | Erros: avaliação vai para a tela de erro | **D** de #3515 | verde (reparado) | **meu**, duplicado: mesmas duas páginas que o #3515 faz melhor. Recomendo **fechar** (quem fecha é o chat principal/Daniel; não fechei) |
| 30 | #3672 | E654 evidência | M | verde (reparado) | só docs |
| 31 | #3681 | E775 desenho da fila + esta triagem | M | verde | só docs |

## Conflitos entre PRs (por `git merge-tree`, pares)
Todos os 31 estão limpos contra a base. Entre si, só conflitam:
1. `docs/e293-auditoria-retencao.md` (todos acrescentam ao fim): **#3515, #3516, #3528, #3529, #3655**. É conflito de texto trivial, mas aparece em cadeia: o primeiro que entrar deixa os outros "sujos". Resolver na pista dona, nesta ordem: #3515 → #3528 → #3529 → #3655 (e o #3516 fecha por ser duplicado).
2. `src/app/.../avaliacao-imovel/[id]/page.tsx`: **#3515 × #3667** (duplicado).
3. `src/lib/data/prova-actions.ts`: **#3516 × #3593** (duplicado).

## Ordem de merge sugerida (um por vez, retestando como no E775)
#3598 → #3515, #3528, #3529 (resolvendo o doc) → #3593 → #3464, #3488, #3491, #3509 → #3531, #3532, #3573, #3580, #3612, #3524 → #3579 → #3596 → #3588 → #3597 → docs (#3534, #3545, #3594, #3602, #3637, #3641, #3655 depois dos três de erros, #3672, #3681) → #3595 depois de reconferido.
Regra: cadeia e merge automático nunca ao mesmo tempo; main vermelha pausa.

## Para fechar (recomendação; nada foi fechado)
- #3667 (duplicado de #3515) e #3516 (duplicado de #3593).

## Massa de teste existente em produção (só leitura, 09/11)
14 perfis `is_teste`; 26 anúncios com título `[TESTE…]`; 50 anúncios de donos `is_teste`; 18 contratos de donos `is_teste`; 5 parceiros de contas `is_teste`. A parte (b) da pausa (preparar a massa que a fila 🟡 pede, **só por ferramenta de admin, sem SQL avulso**) **não foi iniciada**: a fila de provas 🟡 vive no chat principal. Preciso da lista (item, conta e anúncio necessários) para checar o que já existe e propor só o que falta.
