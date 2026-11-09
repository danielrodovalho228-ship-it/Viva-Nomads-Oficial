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


---

# ATUALIZAÇÃO (09/11, ~12h UTC) — triagem completa dos PRs abertos da Pista B

## Correção do escopo
A tabela acima (31 PRs) cobria só os **200 PRs abertos mais recentes**. Varrendo todas as páginas da API, o repositório tem cerca de **1.000 PRs abertos** e **111 são da Pista B** (`claude-b/*`; 110 em rascunho e 2 prontos: #3598 e #3602). Esta seção cobre os 111. Main continua em `344e3a2` (vermelha só pelo drift do E727/E728, que o #3598 corrige).

## Método
1. Conflito de cada PR contra a base com `git merge-tree`; 2. "contido na main": nenhum PR tem todos os arquivos já iguais aos da main; 3. sobreposição de arquivos entre pares e conflito real por par; 4. checks: só tenho leitura recente dos PRs marcados "verde" ou "drift" (conferidos nesta sessão); **os demais ficam "—" (não conferidos)**. Não li o log de cada vermelho.
Classes: **M** mergeável; **M\*** mergeável depois de atualizar com a main que já tenha o #3598; **D** duplicado; **O** obsoleto (provável = pelo título/arquivos, não pelo diff completo); **C** conflita com a base (a pista dona resolve, não o Daniel); **B** bloqueado por base empilhada.

## Números
- 111 PRs; **5 conflitam com a base**: #2951, #3098, #3215, #3253, #3258.
- 216 pares de PRs compartilham arquivo; **104 pares conflitam entre si** (quase todos por mexerem no mesmo arquivo de ação ou no fim de `docs/e293-auditoria-retencao.md`). Arquivos que mais geram conflito: `docs/e293-auditoria-retencao.md` (9 PRs), `src/lib/data/actions.ts` (11), `pedidos-actions.ts`, `propostas-actions.ts`, `estadia-actions.ts` (6 cada), `src/config/retencao.ts` (5).
- Efeito prático: depois que um PR de um desses arquivos entra, os outros ficam "sujos" e precisam de atualização com a main. Por isso a fila serial do E775 e o procedimento "atualizar → CI → gate" valem mesmo.

## Duplicados e obsoletos (recomendação; nada foi fechado)
- **#3667** (meu) duplica o **#3515** (o QA já registrou: manter o #3515, retirar a aprovação do #3667).
- **#3516** duplica parte do **#3593** (mesmo `prova-actions.ts`).
- **#3354** duplica o **#3464** (mesmo teste `e293-leituras-conferencia.test.ts`).
- **#3074** e **#3221**: o mesmo relatório de retenção de 07/11.
- **#3253** (E691 selo): a main já tem `e8004d7dd`; **#3258** (E687 doc): `docs/e687-mudanca-propria.md` já está na main; **#2772**: o título já existe na main; **#3364**: resumo de prontidão de 08/11, superado por esta triagem.
- Relatórios/inventário E293 antigos (**#2993, #3266, #3308, #3393**): cobertos por **#3594** e **#3655**.

## Tabela dos 111 PRs
| # | Estado | Base | Arquivos | Checks | Conflito | Classe / nota | Título |
|---|---|---|---|---|---|---|---|
| 2771 | D | main | 1 | — | limpo | M | t719 B: alinha ao E508 (anúncio no ar sem pendência na lista) |
| 2772 | D | main | 2 | — | limpo | **O (provável)**: o título já existe num commit da main | t186/t204: data de disponibilidade sempre no futuro |
| 2777 | D | main | 6 | — | limpo | M | t204 em dia + o rascunho que chega tarde não apaga as fotos já enviada |
| 2862 | D | main | 9 | — | limpo | M | E637 (b): ações da caução e dossiê em PDF (atrás da chave desligada) |
| 2927 | D | main | 5 | — | limpo | M | E640: testes permanentes de fluxo — foto repetida e recusa de outra co |
| 2938 | D | main | 4 | — | limpo | M | E366: caixa de e-mails de teste não vira 404 quando a leitura do perfi |
| 2942 | D | main | 6 | — | pares: #3006, #3449, #3593 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Erros (achado nº 20): respostas recebidas e respostas prontas não dize |
| 2951 | D | main | 21 | — | base; pares: #3183, #3204, #3212, #3260, #3265… | **C**: conflita com a main (21 arquivos, E647); a pista dona resolve | E647: forma de pagamento é escolha do dono (bloco, mensal ou ambos), s |
| 2952 | D | main | 7 | — | limpo | M (série "falha de leitura não vira…") | Erros (achado nº 21): contadores da fila e conversas/atas da Central n |
| 2955 | D | main | 2 | — | limpo | M | E414 (4ª reprova): a falha de conexão com o servidor de teste diz qual |
| 2958 | D | main | 2 | — | limpo | M | E440: a página da estadia mostra o pedido e o orçamento de origem (últ |
| 2986 | D | main | 5 | — | limpo | M | E413 (reprova "Unable to play media."): a câmera do computador não abr |
| 2992 | D | main | 5 | — | limpo | M (série "falha de leitura não vira…") | Varredura de erros (rodada 25): achados 131–133 — falha de leitura dos |
| 2993 | D | main | 2 | — | pares: #3266, #3308, #3393, #3594 | **O (parcial)**: inventário 0313–0314, coberto por #3594/#3655 | E293: inventário de retenção descreve as colunas das migrações 0313 (E |
| 2994 | D | main | 1 | — | limpo | M | E392 (E365-bis): guarda permanente — o comprovante de vínculo fica esc |
| 3004 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Varredura de erros (rodada 26): achados 134–135 — a ficha do candidato |
| 3006 | D | main | 5 | — | pares: #2942 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Varredura de erros (rodada 27): achados 136–138 — falha de leitura não |
| 3007 | D | main | 3 | — | pares: #3070, #3383 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Varredura de erros (rodada 28): achados 139–140 — falha de leitura da  |
| 3008 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Varredura de erros (rodada 29): achados 141–142 — o bloco Confiança da |
| 3009 | D | main | 4 | — | limpo | M (série "falha de leitura não vira…") | Varredura de erros (rodada 30): achado 143 — a tela de Privacidade não |
| 3036 | D | main | 5 | — | pares: #3101, #3105, #3178 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Varredura de erros (rodada 31): achados 144–148 — a falha de leitura n |
| 3044 | D | main | 6 | — | pares: #3122, #3129, #3182, #3488 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | fix: varredura de erros rodada 32 — leitura que falha não vira "não en |
| 3053 | D | main | 4 | — | pares: #3178 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | fix: varredura de erros rodada 33 — leitura que falha não vira "não en |
| 3070 | D | main | 3 | — | pares: #3007, #3383 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 156: a falha de leitura da proposta não vira 404 |
| 3071 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 157: a falha de leitura do chamado no admin não vira 404 |
| 3072 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 158: a falha de leitura das instruções de entrada não vira " |
| 3073 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 159: a falha de leitura do checklist de estrutura não libera |
| 3074 | D | main | 1 | — | pares: #3221, #3266, #3308, #3515, #3516… | **D** de #3221 (os dois = relatório de retenção de 07/11); superados pelo relatório mais novo (#3594/#3655 §12) | E293: relatório numerado de retenção de 07/11 (migração 0313; nenhuma  |
| 3098 | D | main | 4 | — | base; pares: #3354, #3464 | **C**: conflita com a base (`conferencia-actions.ts`); a pista dona resolve | Auditoria 160: a falha de leitura do contrato na conferência não vira  |
| 3099 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 161: a falha de leitura da pendência de conforto não vira "n |
| 3100 | D | main | 4 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 162: Sair da Viva não afirma "sem pendências" nem "conta pau |
| 3101 | D | main | 3 | — | pares: #3036 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 163: a falha de leitura do pedido de parceria no admin não v |
| 3103 | D | main | 6 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 164: a falha de leitura na vistoria não vira "não encontrado |
| 3105 | D | main | 4 | — | pares: #3036, #3213, #3384 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 165: a falha de leitura do pedido de visita e do item de doc |
| 3106 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 166: a falha de leitura do chamado no atendimento não vira " |
| 3108 | D | main | 5 | — | pares: #3208, #3307, #3449 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 167: falha de leitura no documento fiscal, na conferência do |
| 3109 | D | main | 4 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 168: falha de leitura da matrícula e do documento fiscal no  |
| 3120 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 169: a falha de leitura do pedido de ajuda para publicar não |
| 3121 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Auditoria 170: a falha de leitura do imóvel/contrato nos cartões de co |
| 3122 | D | main | 4 | — | pares: #3044 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 171: a falha de leitura do pedido de serviço e da solicitaçã |
| 3127 | D | main | 3 | — | pares: #3326 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 172: a falha de leitura do contrato na hora de assinar não v |
| 3128 | D | main | 3 | — | pares: #3214 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 173: a falha de leitura do pedido do parceiro não vira "Pedi |
| 3129 | D | main | 3 | — | pares: #3044, #3344, #3488 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 174: a falha de leitura da proposta de aditivo e do contrato |
| 3178 | D | main | 5 | — | pares: #3036, #3053 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 175: a falha de leitura do imóvel, do documento emitido e do |
| 3182 | D | main | 3 | — | pares: #3044 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 176: a falha de leitura da foto da galeria do parceiro não v |
| 3183 | D | main | 3 | — | pares: #2951 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Auditoria 177: a falha de leitura do contrato existente não vira "não  |
| 3204 | D | main | 3 | — | pares: #2951, #3260 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Achado 178: leitura do motivo no perfil que falha não deixa a candidat |
| 3208 | D | main | 3 | — | pares: #3108, #3307, #3449 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Achado 179: responderPedido — leitura que falha não vira "pedido não e |
| 3209 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Achado 180: aprovarSugestao — leitura que falha não vira "sugestão não |
| 3211 | D | main | 3 | — | pares: #3265, #3344 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Achado 181: assinatura do aditivo — leitura que falha não vira "peça o |
| 3212 | D | main | 3 | — | pares: #2951, #3265, #3307, #3383 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Achado 182: propostas — leitura do lead que falha não vira "escolha um |
| 3213 | D | main | 3 | — | pares: #3105, #3384 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Achado 183: visitas — leitura do imóvel e do pedido que falha não vira |
| 3214 | D | main | 3 | — | pares: #3128 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Achado 184: pedidos a parceiros — leitura do pedido, do parceiro e do  |
| 3215 | D | main | 3 | — | base; pares: #3354, #3464 | **C**: conflita com a base (`conferencia-actions.ts`); a pista dona resolve | Achado 185: conferência — leitura de "fechada" e de "já tem laudo" que |
| 3216 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Achado 186: vistoria — pedirAvaliacao: leitura do imóvel, dos preços e |
| 3217 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Achado 187: vistoria — proporPrecoEPrazo: leitura do pedido e gravação |
| 3219 | D | main | 3 | — | limpo | M (série "falha de leitura não vira…") | Achado 188: medição de internet — leitura do papel que falha não vira  |
| 3221 | D | main | 1 | — | pares: #3074, #3266, #3308, #3515, #3516… | **D** de #3074; superado pelo relatório mais novo | E293: relatório de retenção de 07/11 (migrações 0313, 0315 e 0320; só  |
| 3253 | D | main | 5 | — | base; pares: #3515, #3667 | **O (provável)**: a main já tem `e8004d7dd` (selo do E691 no painel do avaliador e no bloco do dono), mesmo objetivo; conflita com a base | E691: o número e o hash da assinatura do laudo aparecem ao avaliador e |
| 3258 | D | main | 1 | — | base | **O (provável)**: `docs/e687-mudanca-propria.md` já está na main (#3292); conflita com a base | E687: Mudança/frete já é categoria própria — achado e lacuna (doc) |
| 3260 | D | main | 3 | — | pares: #2951, #3204 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Leitura que falha: motivo da estadia no perfil não vira candidatura se |
| 3265 | D | main | 4 | — | pares: #2951, #3211, #3212, #3307, #3344… | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Leitura que falha (2ª volta): instruções da estadia, aditivo e candida |
| 3266 | D | main | 2 | — | pares: #2993, #3074, #3221, #3308, #3393… | **O (parcial)**: relatório/inventário E293 das migrações 0313–0321, coberto por #3594/#3655 (mesmo arquivo `retencao.ts`) | E293: inventário de retenção descreve as colunas das migrações 0313 a  |
| 3307 | D | main | 3 | — | pares: #2951, #3108, #3208, #3212, #3265… | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Erros/estados vazios (rodada 3): falha de leitura de candidatura e ped |
| 3308 | D | main | 2 | — | pares: #2993, #3074, #3221, #3266, #3393… | **O (parcial)**: idem (0322–0326), coberto por #3594/#3655 | E293 — retenção: rodada 0322–0326 (inventário e relatório) |
| 3326 | D | main | 2 | — | pares: #3127 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Erros/estados vazios (rodada 4): pedir o código de assinatura não vira |
| 3330 | D | main | 1 | — | limpo | M | E690: levantamento — avaliação de teste do UDI-002 já registrada; falt |
| 3344 | D | main | 2 | — | pares: #3129, #3211, #3265, #3488 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Erros/estados vazios (rodada 5): aditivo da estadia — falha de leitura |
| 3354 | D | main | 2 | — | pares: #3098, #3215, #3464 | **D** de #3464 (mesmo teste `e293-leituras-conferencia.test.ts`; ambos conferência) | Erros/estados vazios (rodada 6): conferência — falha de leitura não vi |
| 3364 | D | main | 1 | — | limpo | **O**: resumo de prontidão de 08/11, superado por esta triagem | Pista B: resumo de prontidão dos PRs abertos para o merge dirigido (só |
| 3375 | D | main | 2 | — | limpo | M (série "falha de leitura não vira…") | Erros/estados vazios (rodada 7): abrir chamado — falha ao conferir o c |
| 3376 | D | main | 2 | — | limpo | M (série "falha de leitura não vira…") | Erros/estados vazios (rodada 8): manutenção — falha ao ler a ordem não |
| 3378 | D | main | 2 | — | limpo | M (série "falha de leitura não vira…") | Erros/estados vazios (rodada 9): contador de imóveis do pedido — falha |
| 3383 | D | main | 2 | — | pares: #2951, #3007, #3070, #3212, #3265… | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Erros/estados vazios (rodada 10): propostas — falha de leitura não vir |
| 3384 | D | main | 2 | — | pares: #3105, #3213 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Erros/estados vazios (rodada 11): visitas — falha de leitura não vira  |
| 3393 | D | main | 2 | — | pares: #2993, #3266, #3308, #3594 | **O (parcial)**: idem (0315–0327), coberto por #3594/#3655 | E293: inventário de retenção descreve as colunas das migrações 0317, 0 |
| 3398 | D | main | 6 | — | limpo | M | E719: cartão do contrato lê o estado real da avaliação — publicada tir |
| 3407 | D | main | 2 | — | pares: #2951 | M — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | E660 (resíduo): a edição do anúncio publicado ganha a ficha "o que tem |
| 3428 | D | main | 1 | — | limpo | M | E687: decisão e evidência das três dúvidas do PR #3292 (só documentaçã |
| 3449 | D | main | 3 | — | pares: #2942, #3108, #3208, #3307, #3593 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | E293 r12: pedidos de moradia — leitura que falha não vira vazio nem "n |
| 3464 | D | main | 3 | verde | pares: #3098, #3215, #3354 | M: manter este; o #3354 duplica | E293 r13: conferência — leitura que falha não vira "aberta" nem "sem l |
| 3488 | D | main | 3 | verde | pares: #3044, #3129, #3265, #3344 | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | E293 r14: estadia — leitura que falha não vira "só o proprietário", "c |
| 3491 | D | main | 3 | verde | limpo | M (série "falha de leitura não vira…") | E293 r15: candidaturas do morador — leitura que falha não vira "ningué |
| 3509 | D | main | 3 | verde | limpo | M (série "falha de leitura não vira…") | E293 r16: triagem do vínculo — leitura que falha não vira "nenhum comp |
| 3515 | D | main | 4 | verde | pares: #3074, #3221, #3253, #3266, #3308… | M: **fica este**; mais completo que o #3667 | Erros/estados vazios (r17): falha ao ler o pedido de avaliação não vir |
| 3516 | D | main | 3 | verde | pares: #3074, #3221, #3266, #3308, #3515… | **D** de #3593 (mesmo arquivo `prova-actions.ts`, conflitam) | Erros/estados vazios (r18): falha ao conferir o dono do imóvel nas pro |
| 3524 | D | main | 16 | verde | pares: #2951 | M — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | E690: ativação automática do avaliador atrás de chave (0335) |
| 3528 | D | main | 7 | verde | pares: #3074, #3221, #3266, #3308, #3515… | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Erros/estados vazios (r19): renovação do contrato e pets da candidatur |
| 3529 | D | main | 7 | verde | pares: #3074, #3221, #3266, #3308, #3515… | M (série "falha de leitura não vira…") — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | Erros/estados vazios (r20): agenda do parceiro, instruções de entrada  |
| 3531 | D | main | 5 | verde | limpo | M | E742: /api/proximidades responde 200 "sem_endereco" ao dono de anúncio |
| 3532 | D | main | 4 | verde | limpo | M | E743: selo da assinatura do laudo sem onFocus em componente de servido |
| 3534 | D | main | 1 | verde | limpo | M | E745: documenta a causa do backup/restore falharem — cinco segredos do |
| 3545 | D | main | 1 | verde | limpo | M | E256: diagnóstico da porta de QA — 404 com chave "válida" é configuraç |
| 3573 | D | main | 6 | verde | limpo | M | E766: /admin mostra o backup saudável (última cópia OK e último teste  |
| 3579 | D | main | 14 | verde | limpo | M: base do #3596 | E752: Caução com valor do 1º bloco no anúncio e texto público alinhado |
| 3580 | D | main | 4 | verde | limpo | M | E751: imagem de uma cor só não é "Foto tremida ou sem foco" (motivo: i |
| 3588 | D | main | 9 | verde | limpo | M; `lab-critico` ficou vermelho após commit meu, **revertido**; verde no run 42609772584 | E744: suíte noturna fatiada em 16 jobs paralelos (a suíte completa pas |
| 3593 | D | main | 6 | verify vermelho (drift provável) | pares: #2942, #3449, #3516 | M*: superconjunto do #3516 | Erros/estados vazios (r21): respostas dos pedidos, detecção de fotos e |
| 3594 | D | main | 2 | verify vermelho (drift provável) | pares: #2993, #3266, #3308, #3393 | M — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | E293: relatório de retenção de 08/11 (migrações 0313–0334; só leitura  |
| 3595 | D | main | 4 | verify vermelho (drift provável) | pares: #2951 | M — conflita com outros PRs que mexem no mesmo arquivo; resolver em ordem | E705: excluir rascunho apaga também as fotos que só existem no draft_d |
| 3596 | D | → e752-caucao-valor | 9 | verde | limpo | **B** (#3579) | E776: textos-fonte únicos (contato, caução, taxas) + gate de frases pr |
| 3597 | D | → e744-suite-fatiada | 10 | verde | limpo | **B** (#3588) | E775: gate de merge próprio (pode-mesclar) para testar a COMBINAÇÃO —  |
| 3598 | R | main | 1 | — | limpo | **M (primeiro)**: corrige a main; pronto (não é draft) | fix(main): testes do E727/E728 alinhados ao formulário combinado com E |
| 3602 | R | main | 1 | verify vermelho (drift provável) | limpo | M*: só docs; pronto (não é draft); verify vermelho = drift | docs(CLAUDE.md): finishing só PR; "ready" só com a saída do teste cola |
| 3612 | D | main | 5 | verde | limpo | M | E768: fotos do detalhe do anúncio carregam sem ficar em branco (sizes  |
| 3637 | D | main | 1 | verify vermelho (drift provável) | limpo | M | E778: evidência do Superpowers na sessão da Pista B (docs) |
| 3641 | D | main | 1 | verify vermelho (drift provável) | limpo | M | docs(E755): o que se sabe do mecanismo da troca de títulos (ambientes  |
| 3655 | D | main | 4 | verde | pares: #3074, #3221, #3266, #3308, #3515… | M; fim de `docs/e293-auditoria-retencao.md` conflita com outros | E293: inventário de retenção cobre `contratos` e a guarda reconhece in |
| 3667 | D | main | 5 | verde | pares: #3253, #3515 | **D** de #3515 (QA também recomendou manter o #3515 e retirar a aprovação do #3667) | Erros dos fluxos logados: falha de consulta nas telas de avaliação vai |
| 3672 | D | main | 2 | verde | limpo | M | docs(E654): evidência depois do fix — e-mails do código de assinatura  |
| 3681 | D | main | 2 | verde | limpo | M (docs); verify estava vermelho por drift, reparado (merge do #3598) | docs(E775): desenho da fila de merge — organização + fila nativa × fil |

## O que a pista dona precisa fazer (só depois da pausa, em ordem)
1. Resolver os 5 conflitos com a base (#2951, #3098, #3215, e decidir #3253 e #3258 como obsoletos).
2. Para a série "falha de leitura não vira…" (cerca de 60 PRs), mesclar em ordem e atualizar cada branch com a main a cada merge; a ordem sugerida é pelo arquivo comum mais disputado.
3. Reconferir os checks de todos depois do #3598 (hoje só estão conferidos os marcados).
