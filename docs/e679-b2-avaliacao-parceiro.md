# E679-B, parte 2 — avaliação do parceiro igual à da estadia (migração 0323)

Empilhado sobre o PR 1/3 (usa `src/lib/avaliacoes-criterios.ts` e o gatilho "fato falso × caução" da 0322). Produção conferida em 07/11/2026: `parceiro_avaliacoes`, `avaliacao_respostas` e `avaliacao_contestacoes` com 0 linhas.

## O que mudou
- **Critérios fixos**: cliente avalia qualidade · pontualidade · cuidado com o imóvel; parceiro avalia comunicação · imóvel pronto para o serviço · combinado cumprido. + etiquetas, "recomendaria", comentário público até 500, nota privada para a outra parte e para a Viva. Exigidos no banco (gatilho `parceiro_avaliacao_valida`).
- **Janela cega de 14 dias** a partir de `concluido_em` (conclusão/entrega). Sem edição depois de enviada (o gatilho recusa qualquer UPDATE de conteúdo, inclusive da service role).
- **Mesmo motor**: `publicar_avaliacoes_parceiro` (cron diário que já existia) publica quando os dois enviam OU a janela fecha. Não há segundo motor. A `nota_media` e `avaliacoes_qtd` do parceiro agora recalculam sobre as PUBLICADAS do cliente e também quando uma avaliação é removida.
- **Moderação só por ofensa ou dado pessoal** (telefone, e-mail, rede, documento): vai para `em_moderacao` pelo gatilho, não pela família de mensagens. O servidor deixou de mascarar o texto.
- **Resposta pública e revisão**: mesma trilha (`avaliacao_respostas`, `avaliacao_contestacoes` ganharam `parceiro_avaliacao_id`). Uma resposta por avaliação, até 500, sem edição. Revisão com motivo objetivo; "fato falso" passa pela regra de caução. A decisão do admin (`decidirRevisaoAvaliacao`) cobre as duas e recalcula a nota do parceiro; a fila de pendências mostra as duas.
- **Nota parceiro → cliente só entre parceiros**: RLS (`parceiro_avaliacao_legivel`), RPC `nota_do_cliente_entre_parceiros` (exige parceiro ativo e que não seja o próprio cliente) e a tela do pedido (`podeLerAvaliacaoDoPedido`): o cliente avaliado não recebe a nota. Não existe consulta pública. As notas privadas ficaram fora do `grant select` do `authenticated`.

## Prova
Testes escritos antes (vermelhos): `src/lib/parceiros/avaliacoes-e679.test.ts` (6) e `tests/migracoes/parceiro-avaliacoes-0323.test.ts` (6). A migração rodou duas vezes (idempotente) e o `aplicar-0323.sql` também, num Postgres 16 local com esquema mínimo, com este cenário: critérios faltando/de outro par/terceiro recusados; telefone no texto vira `em_moderacao`; publicação cega com recálculo da média (4,0 com 1); edição depois de enviada recusada; o cliente avaliado lê só a própria; outro parceiro lê a nota parceiro → cliente; quem não é parceiro lê nada; o próprio cliente e quem não é parceiro não recebem a nota pela RPC; notas privadas dão "permission denied"; resposta única; remoção zera a média.

## Dúvidas (leitura conservadora aplicada)
1. O cliente avaliado nunca vê a nota do parceiro sobre ele; por isso resposta e revisão valem só para a avaliação do cliente sobre o parceiro. Se o Daniel quiser que o cliente veja e conteste a nota recebida, é outra decisão (contraria a premissa).
2. A avaliação do cliente sobre o parceiro continua legível só pelas duas partes do pedido (como já era); a exibição pública dos comentários na página do parceiro não existe hoje e não foi criada aqui.
3. Quem é "parceiro" na leitura entre parceiros: conta com cadastro em `parceiros` com status `publicado` ou `pausado`.
4. Specs E2E do pedido que avaliam só com nota + texto passam a precisar dos critérios e do sim/não (Pista C).
