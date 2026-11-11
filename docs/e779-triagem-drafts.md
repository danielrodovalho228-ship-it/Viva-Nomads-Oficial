# E779 — Triagem dos PRs abertos e proposta de teto de WIP (11/11/2026)

**Só levantamento, nada fechado.** Fechar é decisão do chat principal/Daniel. Dados: API do GitHub em 11/11 (600 PRs abertos; 2.711 fechados lidos, 2.660 mesclados). A classificação é automática pelo título (código `E###`), e **cada fechamento precisa de uma olhada humana** — título pode citar um item sem ser a correção dele.

## Números

- Abertos: **998** (984 em draft).
- Por pista: claude-c 817, claude-b 114, claude-a 57, renato-d 5, renato 3, claude 2.
- Abertos há mais de 7 dias (pela data de criação; a atualização da base em 11/11 mexeu na data de atualização de muitos): **303**.
- guarda/spec de QA (Pista C) — conferir com a lista se a spec ainda vale: **817**
- sem código E (anterior à lista-master ou tarefa avulsa): **93**
- superado? — todos os itens citados já têm PR mesclado: **52**
- item com PR em voo (sem merge do item): **36**

## Proposta de teto de WIP

- **5 PRs em voo por pista** (aberto e não mesclado), contando drafts. Acima disso a pista não abre PR novo: primeiro leva um dos seus a mesclado ou fecha com registro.
- Guardas/specs da Pista C contam no teto da Pista C.
- **Varredura semanal** (sugestão: segunda, antes da primeira rodada): PR sem atualização há 7+ dias entra numa lista para decisão; superado (item já mesclado por outro PR) é fechado com comentário apontando o PR que mesclou.
- Hoje todas as pistas estão muito acima do teto (ver números). Atingir 5/pista exige a triagem abaixo.

## Candidatos a fechar (superado? — todos os itens do título já têm PR mesclado)

| PR | pista | atualizado | itens → PR mesclado | título |
|---|---|---|---|---|
| #2765 | claude-a | 2026-11-05 | 455→#2912 | E455 (ii): painel "Fale com a Viva" fecha ao tocar fora e com Esc — não fica sobre o rodap |
| #2767 | claude-a | 2026-11-06 | 457→#2912 | E457: painéis de filtro da busca — Tipo, Preço e Nível aplicam e fecham ao escolher; Datas |
| #2771 | claude-b | 2026-11-05 | 508→#2448 | t719 B: alinha ao E508 (anúncio no ar sem pendência na lista) |
| #2862 | claude-b | 2026-11-06 | 637→#2861 | E637 (b): ações da caução e dossiê em PDF (atrás da chave desligada) |
| #2927 | claude-b | 2026-11-06 | 640→#2860 | E640: testes permanentes de fluxo — foto repetida e recusa de outra conta |
| #2948 | claude-a | 2026-11-06 | 555→#2524; 563→#2555 | E555/E563: /planos e /precos fechadas de ponta a ponta com os preços suspensos |
| #2955 | claude-b | 2026-11-06 | 414→#3145 | E414 (4ª reprova): a falha de conexão com o servidor de teste diz qual é e o caminho — dia |
| #2958 | claude-b | 2026-11-06 | 440→#2663 | E440: a página da estadia mostra o pedido e o orçamento de origem (último elo da cadeia) |
| #2986 | claude-b | 2026-11-06 | 413→#2046 | E413 (reprova "Unable to play media."): a câmera do computador não abre com tela preta |
| #2998 | claude-a | 2026-11-06 | 442→#3435 | E442 (celular): teste permanente do toque no preço do mapa abrir o mesmo cartão |
| #3074 | claude-b | 2026-11-07 | 293→#2875 | E293: relatório numerado de retenção de 07/11 (migração 0313; nenhuma deleção nova) |
| #3088 | claude-a | 2026-11-07 | 662→#3238 | E662: instrução única de saída — bloqueado por migração (registro e proposta) |
| #3221 | claude-b | 2026-11-07 | 293→#2875 | E293: relatório de retenção de 07/11 (migrações 0313, 0315 e 0320; só leitura, nada apagad |
| #3230 | claude-a | 2026-11-07 | 679→#3363 | E679 (Pista A): inventário das telas de avaliações e bloqueio de entrada — mockups fora do |
| #3242 | renato-d | 2026-11-07 | 661→#3238 | [Faixa D] Main volta ao verde: tsc e unitário E661 (instruções do condomínio e da saída) |
| #3253 | claude-b | 2026-11-07 | 691→#3296 | E691: o número e o hash da assinatura do laudo aparecem ao avaliador e ao dono |
| #3258 | claude-b | 2026-11-07 | 687→#3402 | E687: Mudança/frete já é categoria própria — achado e lacuna (doc) |
| #3266 | claude-b | 2026-11-07 | 293→#2875 | E293: inventário de retenção descreve as colunas das migrações 0313 a 0321 |
| #3284 | claude-a | 2026-11-08 | 679→#3363 | E679 (2/5): página e formulário "Avalie sua estadia / Avalie o morador" iguais aos mockups |
| #3288 | claude-a | 2026-11-08 | 679→#3363 | E679 (3/5): "Responder à avaliação" igual ao mockup e texto "o avaliado responde" |
| #3289 | claude-a | 2026-11-08 | 679→#3363 | E679 (4/5): avaliações nos perfis públicos do proprietário e do parceiro, com resumo das n |
| #3290 | claude-a | 2026-11-08 | 679→#3363 | E679 (5/5): "Avalie o serviço" e "Avalie o cliente" iguais aos mockups |
| #3308 | claude-b | 2026-11-07 | 293→#2875 | E293 — retenção: rodada 0322–0326 (inventário e relatório) |
| #3314 | claude-a | 2026-11-07 | 661→#3238; 702→#3280 | E702 + E661: conclusões dos resíduos de código (só documentação) |
| #3330 | claude-b | 2026-11-08 | 690→#3524 | E690: levantamento — avaliação de teste do UDI-002 já registrada; falta só a ativação pelo |
| #3393 | claude-b | 2026-11-08 | 293→#2875 | E293: inventário de retenção descreve as colunas das migrações 0317, 0320, 0323 e 0325 (só |
| #3407 | claude-b | 2026-11-08 | 660→#3085 | E660 (resíduo): a edição do anúncio publicado ganha a ficha "o que tem dentro" |
| #3417 | claude-a | 2026-11-08 | 460→#2627 | E460 (resíduo): varredura completa do menu do parceiro — nenhuma tela acende a aba errada  |
| #3428 | claude-b | 2026-11-08 | 687→#3402 | E687: decisão e evidência das três dúvidas do PR #3292 (só documentação) |
| #3432 | claude-a | 2026-11-08 | 527→#3444 | E527 (resíduo): amostras da legenda do calendário do anúncio mais legíveis |
| #3449 | claude-b | 2026-11-08 | 293→#2875 | E293 r12: pedidos de moradia — leitura que falha não vira vazio nem "não disponível" |
| #3464 | claude-b | 2026-11-08 | 293→#2875 | E293 r13: conferência — leitura que falha não vira "aberta" nem "sem laudo" |
| #3488 | claude-b | 2026-11-08 | 293→#2875 | E293 r14: estadia — leitura que falha não vira "só o proprietário", "contrato" nem "propos |
| #3491 | claude-b | 2026-11-08 | 293→#2875 | E293 r15: candidaturas do morador — leitura que falha não vira "ninguém falou" nem "sem co |
| #3509 | claude-b | 2026-11-08 | 293→#2875 | E293 r16: triagem do vínculo — leitura que falha não vira "nenhum comprovante", "não encon |
| #3510 | claude-a | 2026-11-08 | 527→#3444 | E527: Ocupado, Bloqueado e Hoje passam de 3:1 no calendário (grade e legenda) |
| #3534 | claude-b | 2026-11-08 | 745→#3560 | E745: documenta a causa do backup/restore falharem — cinco segredos do ambiente backup-pro |
| #3543 | claude-a | 2026-11-08 | 715→#3427 | O4: "N Mbps" em uma linha só em /pedidos/novo (resíduo do E715) |
| #3545 | claude-b | 2026-11-08 | 256→#2492 | E256: diagnóstico da porta de QA — 404 com chave "válida" é configuração do QA_LOGIN_KEY_H |
| #3589 | claude-a | 2026-11-08 | 720→#3455 | E720: voltar do painel em "Estadia confirmada" e na visão do convidado (resíduo da varredu |
| #3594 | claude-b | 2026-11-08 | 293→#2875 | E293: relatório de retenção de 08/11 (migrações 0313–0334; só leitura em produção, nada ap |
| #3595 | claude-b | 2026-11-08 | 705→#3435 | E705: excluir rascunho apaga também as fotos que só existem no draft_data (resíduo 2) |
| #3597 | claude-b | 2026-11-09 | 775→#3681 | E775: gate de merge próprio (pode-mesclar) para testar a COMBINAÇÃO — a fila nativa não ex |
| #3628 | renato-d | 2026-11-09 | 727→#3598; 728→#3598 | [Faixa D] Laboratório verde: foto repetida em /para-proprietarios + testes E727/E728 e lin |
| #3641 | claude-b | 2026-11-09 | 755→#3561 | docs(E755): o que se sabe do mecanismo da troca de títulos (ambientes diferentes) e o que  |
| #3655 | claude-b | 2026-11-09 | 293→#2875 | E293: inventário de retenção cobre `contratos` e a guarda reconhece instrução de saída, no |
| #3672 | claude-b | 2026-11-09 | 654→#3060 | docs(E654): evidência depois do fix — e-mails do código de assinatura chegando, sem falha  |
| #3699 | claude-b | 2026-11-10 | 293→#2875 | E293: revisão de retenção das migrações 0313–0335 (inventário e relatório) |
| #3702 | claude-b | 2026-11-10 | 784→#3620 | E784: "‹ Voltar ao site" volta a existir no admin em todas as larguras (1920 px) |
| #3703 | claude-b | 2026-11-10 | 721→#3466 | E721: ação "Adiar" na conversa em /dashboard/mensagens (migração 0336) |
| #3704 | claude-b | 2026-11-11 | 689→#3414; 759→#3563 | E759/E689: massa 0337 do D-7 de entrada (o jornada_d7 dispara na rodada do cron) |
| #3705 | claude-b | 2026-11-11 | 687→#3402 | E687: massa 0338 do parceiro de Mudança (a 0329 não criou nada em produção) |

### Falsos positivos conhecidos nesta lista (manter abertos)

- **#3703 (E721)** e **#3702 (E784)**: o PR mesclado (#3466, #3620) foi **reprovado** na prova de 10/11 e o item voltou à Pista B; estes são as correções novas.
- **#3704 (E759/E689)** e **#3705 (E687)**: complementos de 11/11 (massas 0337 e 0338) para a prova que faltou; o código do item está mesclado, a massa não.
- **E293** (#3074, #3221, #3266, #3308, #3393, #3449, #3464, #3488, #3491, #3509, #3594, #3655, #3699): trilho recorrente de retenção; o #2875 mesclado foi só a primeira rodada. Sugestão: consolidar no mais novo (#3699) e fechar os anteriores com referência a ele.
- Qualquer item reprovado depois do merge cai aqui como "superado" por engano: conferir na lista-master antes de fechar.


## Itens com mais de um PR aberto (fora as guardas)

| item | PRs abertos |
|---|---|
| E293 | #2026, #2993, #3074, #3221, #3266, #3308, #3393, #3449, #3464, #3488, #3491, #3509, #3594, #3655, #3699 |
| E527 | #3432, #3440, #3510 |
| E647 | #2951, #2993 |
| E661 | #3242, #3314 |
| E679 | #3230, #3284, #3288, #3289, #3290 |
| E687 | #3258, #3428, #3548, #3705 |

## Sem código E no título (anteriores à lista-master ou avulsos)

| PR | pista | atualizado | título |
|---|---|---|---|
| #2772 | claude-b | 2026-11-05 | t186/t204: data de disponibilidade sempre no futuro |
| #2777 | claude-b | 2026-11-06 | t204 em dia + o rascunho que chega tarde não apaga as fotos já enviadas |
| #2942 | claude-b | 2026-11-06 | Erros (achado nº 20): respostas recebidas e respostas prontas não dizem "nada" quando o ba |
| #2952 | claude-b | 2026-11-06 | Erros (achado nº 21): contadores da fila e conversas/atas da Central não dizem "zero"/"nen |
| #2954 | claude-a | 2026-11-06 | Admin financeiro: grade de cartões sem última linha incompleta a 1280px (passada 40) |
| #2992 | claude-b | 2026-11-06 | Varredura de erros (rodada 25): achados 131–133 — falha de leitura dos parceiros não vira  |
| #3004 | claude-b | 2026-11-06 | Varredura de erros (rodada 26): achados 134–135 — a ficha do candidato não decide com pets |
| #3006 | claude-b | 2026-11-06 | Varredura de erros (rodada 27): achados 136–138 — falha de leitura não faz sumir o endereç |
| #3007 | claude-b | 2026-11-06 | Varredura de erros (rodada 28): achados 139–140 — falha de leitura da proposta não vira "n |
| #3008 | claude-b | 2026-11-06 | Varredura de erros (rodada 29): achados 141–142 — o bloco Confiança da Conta não afirma "f |
| #3009 | claude-b | 2026-11-06 | Varredura de erros (rodada 30): achado 143 — a tela de Privacidade não mostra os padrões c |
| #3018 | claude-a | 2026-11-06 | Parceiros/avaliadores: grade do "como funciona" par (2 colunas) |
| #3020 | claude-a | 2026-11-06 | Passo 7: linha "Destaques" do mockup aprovado (cadastro-imovel-07) |
| #3022 | claude-a | 2026-11-06 | Matriz: decisões do Muse aplicadas (Passo 6, Passo 7, cabeçalhos do painel) |
| #3036 | claude-b | 2026-11-06 | Varredura de erros (rodada 31): achados 144–148 — a falha de leitura nas decisões do admin |
| #3044 | claude-b | 2026-11-06 | fix: varredura de erros rodada 32 — leitura que falha não vira "não encontrado" (achados 1 |
| #3053 | claude-b | 2026-11-07 | fix: varredura de erros rodada 33 — leitura que falha não vira "não encontrado" no admin ( |
| #3069 | claude-a | 2026-11-07 | Matriz: passada 46 (assistente Passos 6, 8 e 9 no padrão único do #2956) |
| #3070 | claude-b | 2026-11-07 | Auditoria 156: a falha de leitura da proposta não vira 404 |
| #3071 | claude-b | 2026-11-07 | Auditoria 157: a falha de leitura do chamado no admin não vira 404 |
| #3072 | claude-b | 2026-11-07 | Auditoria 158: a falha de leitura das instruções de entrada não vira "sem acesso" nem "não |
| #3073 | claude-b | 2026-11-07 | Auditoria 159: a falha de leitura do checklist de estrutura não libera edição sobre um che |
| #3096 | claude-a | 2026-11-07 | Varredura 47 (achado 1): Fechamento com área de toque de 44 px nas pílulas e controles |
| #3097 | claude-a | 2026-11-08 | Matriz: passada 47 (telas mexidas pelos merges de 06/11 à noite) |
| #3098 | claude-b | 2026-11-07 | Auditoria 160: a falha de leitura do contrato na conferência não vira "você não faz parte" |
| #3099 | claude-b | 2026-11-07 | Auditoria 161: a falha de leitura da pendência de conforto não vira "não encontrada" nem " |
| #3100 | claude-b | 2026-11-07 | Auditoria 162: Sair da Viva não afirma "sem pendências" nem "conta pausada" quando a leitu |
| #3101 | claude-b | 2026-11-07 | Auditoria 163: a falha de leitura do pedido de parceria no admin não vira "pedido não enco |
| #3103 | claude-b | 2026-11-07 | Auditoria 164: a falha de leitura na vistoria não vira "não encontrado" (PDF do laudo resp |
| #3105 | claude-b | 2026-11-07 | Auditoria 165: a falha de leitura do pedido de visita e do item de documento não vira "não |
| #3106 | claude-b | 2026-11-07 | Auditoria 166: a falha de leitura do chamado no atendimento não vira "chamado não encontra |
| #3108 | claude-b | 2026-11-07 | Auditoria 167: falha de leitura no documento fiscal, na conferência do imóvel e no pedido  |
| #3109 | claude-b | 2026-11-07 | Auditoria 168: falha de leitura da matrícula e do documento fiscal no admin não vira "não  |
| #3120 | claude-b | 2026-11-07 | Auditoria 169: a falha de leitura do pedido de ajuda para publicar não vira "Pedido não en |
| #3121 | claude-b | 2026-11-07 | Auditoria 170: a falha de leitura do imóvel/contrato nos cartões de compartilhar não vira  |
| #3122 | claude-b | 2026-11-07 | Auditoria 171: a falha de leitura do pedido de serviço e da solicitação reclassificada não |
| #3127 | claude-b | 2026-11-07 | Auditoria 172: a falha de leitura do contrato na hora de assinar não vira "Contrato não en |
| #3128 | claude-b | 2026-11-07 | Auditoria 173: a falha de leitura do pedido do parceiro não vira "Pedido não encontrado" |
| #3129 | claude-b | 2026-11-07 | Auditoria 174: a falha de leitura da proposta de aditivo e do contrato nas instruções de c |
| #3172 | claude-a | 2026-11-07 | Varredura 53 (achado 1): link do logo com área de toque de 44 px |
| #3176 | claude-a | 2026-11-07 | Varredura 55 (achados 1 e 2): selo-menu do anúncio e abas de Pedidos de moradia com área d |
| #3178 | claude-b | 2026-11-07 | Auditoria 175: a falha de leitura do imóvel, do documento emitido e do agente não vira "nã |
| #3180 | claude-a | 2026-11-07 | Varredura 57: botões de cobrança do simulador com 44 px de toque |
| #3182 | claude-b | 2026-11-07 | Auditoria 176: a falha de leitura da foto da galeria do parceiro não vira "Foto não encont |
| #3183 | claude-b | 2026-11-07 | Auditoria 177: a falha de leitura do contrato existente não vira "não existe" nem cria out |
| #3184 | claude-a | 2026-11-07 | Varredura 59 (achado 1): − e + de adultos/crianças no filtro Datas da /buscar com 44 px de |
| #3204 | claude-b | 2026-11-07 | Achado 178: leitura do motivo no perfil que falha não deixa a candidatura seguir sem motiv |
| #3208 | claude-b | 2026-11-07 | Achado 179: responderPedido — leitura que falha não vira "pedido não está mais disponível" |
| #3209 | claude-b | 2026-11-07 | Achado 180: aprovarSugestao — leitura que falha não vira "sugestão não encontrada" |
| #3211 | claude-b | 2026-11-07 | Achado 181: assinatura do aditivo — leitura que falha não vira "peça o código" nem libera  |
| #3212 | claude-b | 2026-11-07 | Achado 182: propostas — leitura do lead que falha não vira "escolha um interessado" nem "c |
| #3213 | claude-b | 2026-11-07 | Achado 183: visitas — leitura do imóvel e do pedido que falha não vira "não encontrado" |
| #3214 | claude-b | 2026-11-07 | Achado 184: pedidos a parceiros — leitura do pedido, do parceiro e do serviço que falha nã |
| #3215 | claude-b | 2026-11-07 | Achado 185: conferência — leitura de "fechada" e de "já tem laudo" que falha não vira "abe |
| #3216 | claude-b | 2026-11-07 | Achado 186: vistoria — pedirAvaliacao: leitura do imóvel, dos preços e dos bloqueios que f |
| #3217 | claude-b | 2026-11-07 | Achado 187: vistoria — proporPrecoEPrazo: leitura do pedido e gravação da aceitação que fa |
| #3219 | claude-b | 2026-11-07 | Achado 188: medição de internet — leitura do papel que falha não vira "só o proprietário m |
| #3225 | claude-a | 2026-11-07 | Varredura 65: "+ Outro horário" do agendamento de visita com 44 px de toque |
| #3237 | renato | 2026-11-07 | [Faixa A] Admin › Pendências: specs t229/t231 do laboratório voltam a achar as filas |
| #3251 | claude-a | 2026-11-07 | Passada 68: alvo de 44 px no voltar das subpáginas do imóvel |
| #3259 | claude-a | 2026-11-07 | Passada 69: alvo de 44 px nos links de estado vazio e nas ações de Segurança |
| #3260 | claude-b | 2026-11-07 | Leitura que falha: motivo da estadia no perfil não vira candidatura sem motivo |
| #3265 | claude-b | 2026-11-07 | Leitura que falha (2ª volta): instruções da estadia, aditivo e candidatura da proposta |
| #3307 | claude-b | 2026-11-07 | Erros/estados vazios (rodada 3): falha de leitura de candidatura e pedido |
| #3316 | claude-a | 2026-11-07 | E84 (SEO): páginas de tema da Central de ajuda no sitemap |
| #3326 | claude-b | 2026-11-07 | Erros/estados vazios (rodada 4): pedir o código de assinatura não vira "Contrato não encon |
| #3344 | claude-b | 2026-11-08 | Erros/estados vazios (rodada 5): aditivo da estadia — falha de leitura não vira "Proposta  |
| #3354 | claude-b | 2026-11-08 | Erros/estados vazios (rodada 6): conferência — falha de leitura não vira "aberta" nem "sem |
| #3364 | claude-b | 2026-11-08 | Pista B: resumo de prontidão dos PRs abertos para o merge dirigido (só documentação) |
| #3375 | claude-b | 2026-11-08 | Erros/estados vazios (rodada 7): abrir chamado — falha ao conferir o contexto não o descar |
| #3376 | claude-b | 2026-11-08 | Erros/estados vazios (rodada 8): manutenção — falha ao ler a ordem não vira "não encontrad |
| #3378 | claude-b | 2026-11-08 | Erros/estados vazios (rodada 9): contador de imóveis do pedido — falha de leitura não vira |
| #3383 | claude-b | 2026-11-08 | Erros/estados vazios (rodada 10): propostas — falha de leitura não vira 404 nem "não encon |
| #3384 | claude-b | 2026-11-08 | Erros/estados vazios (rodada 11): visitas — falha de leitura não vira "imóvel indisponível |
| #3388 | claude-a | 2026-11-08 | Editor de anúncio: linha-resumo das seções sem corte com "…" (390 px) |
| #3423 | claude-a | 2026-11-08 | Destaques do anúncio: linha de detalhe sem corte com "…" (1280 px) |
| #3446 | claude | 2026-11-10 | docs(qa): rodadas 11:00 e 11:15 — C20, C21, foco, erros e planos de massa |
| #3454 | claude-a | 2026-11-08 | C10 (conformidade): faixa de /seguranca segue o mockup publico-seguranca |
| #3465 | claude-a | 2026-11-08 | C11 (docs): achados do banner institucional × mockups publico-* |
| #3515 | claude-b | 2026-11-08 | Erros/estados vazios (r17): falha ao ler o pedido de avaliação não vira 404 nem checklist  |
| #3516 | claude-b | 2026-11-08 | Erros/estados vazios (r18): falha ao conferir o dono do imóvel nas provas não vira "Sem pe |
| #3528 | claude-b | 2026-11-08 | Erros/estados vazios (r19): renovação do contrato e pets da candidatura — falha de leitura |
| #3529 | claude-b | 2026-11-08 | Erros/estados vazios (r20): agenda do parceiro, instruções de entrada e código de assinatu |
| #3593 | claude-b | 2026-11-08 | Erros/estados vazios (r21): respostas dos pedidos, detecção de fotos e provas do nível — f |
| #3622 | renato-d | 2026-11-09 | [Faixa D] Lab verde: imagem repetida em /para-proprietarios + 2 unitários e lint da main |
| #3632 | claude-a | 2026-11-09 | Pista A: lista de entrega ao QA da fila visual (7 PRs e provas pendentes) — docs |
| #3666 | claude-a | 2026-11-09 | Conformidade: "Aceita pets", "Acessível" e "Quintal" ganham ícone próprio (um ícone por co |
| #3667 | claude-b | 2026-11-09 | Erros dos fluxos logados: falha de consulta nas telas de avaliação vai para a tela de erro |
| #3698 | renato-d | 2026-11-10 | [Faixa D] Laboratório verde: imagem repetida em /para-proprietarios (t112) |
| #3706 | renato-d | 2026-11-11 | [Faixa D] Laboratório verde: `npm run lint` da main volta a 0 erros (/parceiros e "Voltar  |
| #3707 | claude | 2026-11-11 | [Faixa A] Mapas: README documenta as chaves (ordem 902ea6bf, item 1) |
| #3708 | renato | 2026-11-11 | [Faixa A] fe7ac2e7: provas do F10 (novo anúncio sem 404) e F12 ("Enviando..." não fica pre |
| #3709 | renato | 2026-11-11 | [Faixa A] d5b4f72f: prova no lab do F9 (o 404 do rascunho não fica preso depois de publica |

## Guardas/specs da Pista C

817 PRs. 197 citam só itens já mesclados; 303 foram abertos há mais de 7 dias. A decisão de fechar ou mesclar cada spec é da Pista C/chat principal (uma spec de guarda pode valer mesmo com o item mesclado). Sugestão: fechar em lote as specs abertas há mais de 7 dias cujo item já está mesclado e sem reprova, mantendo uma por item.

## Itens com PR em voo (manter)

| PR | pista | atualizado | itens | título |
|---|---|---|---|---|
| #2928 | claude-a | 2026-11-06 | E373 | E373: a verificação de celular explica por que o campo está desativado |
| #2929 | claude-a | 2026-11-06 | E374 | E374: o placeholder de foto nunca mostra nome de arquivo nem texto de QA |
| #2931 | claude-a | 2026-11-06 | E387 | E387: triagem de fotos — confirmação em massa e o aviso do Passo 2 sai quando as fotos são |
| #2932 | claude-a | 2026-11-06 | E389 | E389: a distância do ponto de referência não muda mais sozinha (mesmo ponto de medida em t |
| #2935 | claude-a | 2026-11-06 | E393 | E393: o código público do anúncio (VN-…) abre a página; a visita e a conversa linkam o anú |
| #2936 | claude-a | 2026-11-06 | E395 | E395: o prazo de resposta "em até 1 dia útil" aparece desde o envio da candidatura |
| #2937 | claude-a | 2026-11-06 | E398 | E398: o cabeçalho público não pisca o "Entrar" para quem tem sessão |
| #2938 | claude-b | 2026-11-06 | E366 | E366: caixa de e-mails de teste não vira 404 quando a leitura do perfil falha |
| #2951 | claude-b | 2026-11-06 | E647 | E647: forma de pagamento é escolha do dono (bloco, mensal ou ambos), só a parte neutra atr |
| #2963 | claude-a | 2026-11-06 | E348 | E348: a ficha de aprovação de parceiro mostra a prova de cada item e quem/quando/base |
| #2966 | claude-a | 2026-11-06 | E349 | E349: entrada do admin no celular mostra as seções, sem caçar o sanduíche |
| #2993 | claude-b | 2026-11-06 | E293, E647, E648 | E293: inventário de retenção descreve as colunas das migrações 0313 (E648) e 0314 (E647) |
| #2994 | claude-b | 2026-11-06 | E365, E392 | E392 (E365-bis): guarda permanente — o comprovante de vínculo fica escondido com a chave T |
| #3079 | claude-a | 2026-11-07 | E478 | E478: sino de avisos do operador em todas as páginas do /admin |
| #3531 | claude-b | 2026-11-11 | E742 | E742: /api/proximidades responde 200 "sem_endereco" ao dono de anúncio sem CEP e sem ponto |
| #3532 | claude-b | 2026-11-11 | E743 | E743: selo da assinatura do laudo sem onFocus em componente de servidor (quebrava /nivel d |
| #3533 | claude-a | 2026-11-08 | E734 | E734: fechar "Mais filtros" devolve o foco ao botão que abriu (WCAG 2.4.3) |
| #3535 | claude-a | 2026-11-08 | E738 | E738: telas do imóvel com um "Voltar" só (o do cabeçalho padrão) |
| #3536 | claude-a | 2026-11-08 | E737 | E737: "Pular para o conteúdo" é o primeiro foco da página (antes do botão flutuante) |
| #3537 | claude-a | 2026-11-08 | E736 | E736: bordas dos campos de formulário com contraste de 3:1 |
| #3573 | claude-b | 2026-11-11 | E766 | E766: /admin mostra o backup saudável (última cópia OK e último teste OK) e /admin/backup( |
| #3574 | claude-a | 2026-11-09 | E757 | E757: texto único para a verificação de identidade (ainda não abriu; a equipe confere o do |
| #3577 | claude-a | 2026-11-08 | E758 | E758: /parceiros — Avaliação anunciada x categorias da busca de parceiros |
| #3578 | claude-a | 2026-11-08 | E763 | E763: /parceiros — duas taxas rotuladas (proprietário 12/10/8/6 + Gestor 4%; parceiro 90/1 |
| #3580 | claude-b | 2026-11-08 | E751 | E751: imagem de uma cor só não é "Foto tremida ou sem foco" (motivo: imagem lisa) |
| #3583 | claude-a | 2026-11-08 | E767 | E767: cartão deixa de prometer "tudo incluído" — "Total por mês, sem IPTU" |
| #3584 | claude-a | 2026-11-08 | E769 | E769: a nota do proprietário diz de quem é (imóvel 4,5 · 2 x proprietário 4,7 · 12) |
| #3585 | claude-a | 2026-11-11 | E773 | E773: guia de precificação não aponta para /precos suspensa |
| #3588 | claude-b | 2026-11-10 | E744 | E744: suíte noturna fatiada em 16 jobs paralelos (a suíte completa passa a terminar) |
| #3612 | claude-b | 2026-11-11 | E768 | E768: fotos do detalhe do anúncio carregam sem ficar em branco (sizes do mosaico + priorid |
| #3694 | claude-b | 2026-11-10 | E785 | E785: gate de frases proibidas barra "contato protegido até o aceite" e variantes |
| #3695 | claude-b | 2026-11-10 | E786 | E786: selo do anúncio de teste quebra linha em vez de estourar na horizontal |
| #3696 | claude-b | 2026-11-10 | E787 | E787: "Continue seu anúncio" não deixa a área da foto em branco |
| #3697 | claude-b | 2026-11-10 | E774 | E774: aviso do /pedidos/novo não sugere contato liberado depois do aceite |
| #3700 | claude-b | 2026-11-10 | E788 | E788: selo "Equipe" do admin sem avatar inerte; inicial do avatar legível e maiúscula |
| #3701 | claude-b | 2026-11-11 | E789 | E789: Conta/Perfil abre com uma leitura só e esqueleto com a forma da tela |
