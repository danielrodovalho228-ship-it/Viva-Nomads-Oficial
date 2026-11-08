# E679 — PR 3: Responder à avaliação

Mockups: `docs/mockups-avaliacoes/avaliacoes-responder-desktop.webp` e `-mobile.webp`. Capturas a 390 e 1280 px (dados de exemplo): `docs/capturas/e679-responder/`.

## O que mudou
- **Página "Responder à avaliação"** (`/dashboard/avaliacoes/responder/[avaliacaoId]`): a avaliação recebida (nome curto, mês e ano, estrelas, comentário entre aspas, "Avaliação da sua estadia em …, publicada em 12 de novembro"), o aviso âmbar **"Você tem direito a UMA resposta pública. Depois de publicar, não dá para editar nem apagar — revise antes de enviar."**, "Sua resposta" com contador n/500, botão cheio "Publicar resposta" e o link **"Contestar avaliação"** (abre o pedido de revisão com motivo objetivo, o mesmo de antes).
- **Só o avaliado vê** (leitura pela sessão das avaliações publicadas sobre a pessoa); de outra pessoa, 404. Já respondida: mostra a resposta e diz que é uma só. O "Responder" de "Recebidas recentes" do painel leva para cá; o botão "Responder" dentro da lista de Recebidas segue funcionando (mesmos testids).
- **Texto público "Como funcionam as avaliações":** passa a dizer que **o avaliado responde** em público, uma vez, e que a resposta não se edita nem se apaga (antes: só o proprietário responde, o que o banco não exigia).
- **Sem migração:** `responderAvaliacao` e a regra de uma resposta por avaliação já existiam (0129).

## Diferença conhecida
- Fundo claro padrão da casa (E166), não o bege do mockup.
