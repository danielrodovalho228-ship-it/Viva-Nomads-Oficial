# Estudo de avaliações — resposta do coordenador (07/11/2026)

Fonte: chat "Vivanomads app atual" (https://claude.ai/chat/59311bf5-781d-8b6c-888e-6ff1e81dd09c)
Pedido do Daniel de 07/11/2026 07:41 CST — item E679 da lista-master.
Mensagem enviada e confirmada visualmente como última do chat (153 de 154). Resposta recebida na mesma execução.

---

Estudo de avaliações: validação ponto a ponto

Conferi migrations, código e produção (Supabase). O achado central: o par dono↔morador já está construído (migrações 0089 e 0129), e o par cliente↔parceiro também (0197). O que falta é consolidar, definir critérios e fechar pontas, não desenhar do zero. Em produção as tabelas avaliacoes, avaliacao_respostas, avaliacao_contestacoes e parceiro_avaliacoes têm 0 linhas, então mudar o desenho não tem custo de migração de dados.

Uma confusão de vocabulário para o Daniel. Na Viva “avaliação” também é o laudo do imóvel feito pelo avaliador (vistoria). Os mockups precisam usar “avaliações” só para notas entre pessoas e “laudo” para a vistoria.

1. Proprietário ↔ morador

Já existe:
Só quem foi parte de um contrato encerrado avalia a outra parte, uma vez, até 14 dias depois do fim (encerrado_em).
Estrelas: nota_geral de 1 a 5, mais notas por categoria (notas_categorias), etiquetas, “recomendaria”, comentário público de até 500 caracteres, nota privada para a outra parte e nota privada para a Viva.
Sem edição depois de enviada.
O formulário AvaliacaoForm já serve aos dois lados.
Falta: as categorias estão só como campo livre no banco e eu não achei a lista fixa. Os critérios de cada lado são desenho novo.
Modelo: é inspirado no Airbnb (categorias + texto + cega), já com vocabulário Viva.
O que eu mudaria na sua opinião: concordo com estrelas + 3 a 4 critérios. O ponto de partida da janela é o fim do contrato, não o check-out. Se for o mesmo dia, ótimo; senão, definir qual.

2. Cliente ↔ parceiro

Já existe: parceiro_avaliacoes, com papéis cliente e parceiro, nota 1–5 e texto de até 500 caracteres. Publica quando as duas partes avaliam ou 14 dias após a conclusão, e atualiza nota_media e avaliacoes_qtd na página do parceiro.
Falta: não tem critérios por categoria, nem resposta pública, nem pedido de revisão (só os status em_moderacao e removida).
Mudaria: igualar ao par dono↔morador (3 critérios curtos, uma resposta, contestação com motivo objetivo). Decisão aberta para o Daniel: a nota que o parceiro dá ao cliente aparece no perfil do cliente, ou só para outros parceiros?

3. Proprietário ↔ avaliador (vistoriador)

Já existe (vistoria_conduta, 0215):
O dono avalia o avaliador em 3 critérios (pontualidade, cordialidade, cuidado com o imóvel).
O avaliador avalia o acesso em 2 critérios (imóvel pronto, horário respeitado).
Abre depois do laudo emitido, 1–5, texto de até 300 caracteres, sem citar o resultado do laudo.
Existe a média pública de conduta do avaliador (notaConduta).
Avaliador × morador não existe, o Daniel está certo: o pedido de vistoria só liga dono e avaliador.
Não verifiquei se essa avaliação de conduta é cega ou publicada na hora.
Concordo com a sua regra: o avaliador só avalia critérios operacionais do dono, e isso já é o desenho.

4. Tempos

Já existe para dono↔morador e para parceiros: janela de 14 dias, cega, com publicação das duas ou no vencimento (função publicar_avaliacoes, rodada pelo cron diário).
Resposta: o banco aceita uma resposta do avaliado por avaliação publicada (até 500 caracteres, sem edição). O texto “Como funcionam as avaliações” diz que só o proprietário responde. Está inconsistente com o banco: ou o texto passa a dizer “o avaliado”, ou o banco restringe.
Para o avaliador: a janela dele é o laudo, não o contrato.

5. Onde aparece

Já existe: bloco de avaliações na página do imóvel (reviews.tsx), cartão do dono (owner-card), perfil público (seu-perfil-publico), cartão do parceiro e nota do avaliador. Duas rotas de painel chamam-se “Avaliações” (/dashboard/avaliacoes no menu e /dashboard/conta/avaliacoes), que é a duplicação do E85 que o Daniel citou. Não abri as duas telas para ver o que cada uma mostra.
Desenho novo: a consolidação dessas telas.

6. Moderação

A família E445 é de mensagens. moderacao_ofensas e o filtro de ofensa são ligados a mensagens e conversas, não a avaliações.
Avaliações têm trilha própria: comentário com telefone, e-mail ou ofensa vai para em_moderacao. O avaliado pode abrir uma contestação por avaliação, com motivo objetivo (ofensa, dado pessoal ou fato falso) e um detalhe de 20 a 500 caracteres. O admin decide (mantida ou removida). Isso bate com a sua regra “só sai por ofensa ou dado pessoal, nunca por nota baixa legítima”.
A Viva pode ocultar: sim, por essa trilha.
Tensão com a disputa da caução: “fato falso” pode virar a Viva julgando quem tem razão numa disputa (ex.: “deixou o imóvel sujo” contra a caução). Mudaria para a regra: contestação por fato falso só vale para fato verificável pela Viva (a estadia não aconteceu, o avaliador não foi), nunca sobre dano ou valor de caução. A avaliação pública não é prova em disputa e a Viva não a usa para decidir.

7. Efeitos

Já existe: a nota alimenta ranking_sinais (avaliacoes_media e avaliacoes_qtd, mais o tempo de resposta). A ordem nova está atrás da chave ORDEM_NOVA_ATIVA, desligada, em modo sombra. Nenhum campo de plano ou cobrança entra nesse ranking, o que sustenta o “merecido, não comprado”.
Não existe: as “conquistas” (fase 2) e qualquer consequência automática de nota mínima. Hoje a única escada de strikes é do dono, por resultado de laudo (proprietario_strikes), não por estrelas.
Mudaria: nota baixa não suspende ninguém automaticamente. Com um mínimo de avaliações (a definir) e média abaixo de um corte (a definir), abre uma revisão humana. Parceiro e avaliador seguem a mesma regra, com o corte decidido pelo Daniel.

Resumo para o Muse

Existe e funciona: a janela de 14 dias, a publicação cega, a resposta única, a contestação, a nota por categoria no banco, as avaliações de parceiro e a conduta do avaliador.
Desenho novo: a lista de critérios por par, categorias e resposta/contestação para parceiros, a consolidação das telas “Avaliações”, a regra “fato falso × caução” e o corte de revisão por nota.
Mudaria no seu texto: a janela parte do fim do contrato, não do check-out. O texto público de “Como funcionam” precisa dizer “o avaliado responde”. O avaliador entra no estudo com a janela do laudo, não a de 14 dias do contrato.
Para confirmar antes de construir: a conduta do avaliador é cega ou não, e o que cada tela “Avaliações” mostra hoje.

Com isso o Muse já pode desenhar os mockups de avaliar, responder e perfil. Os critérios por par ainda precisam ser definidos com o Daniel antes do mockup final.
