# E326 — o link da chamada deve ir no e-mail da visita por vídeo? (proposta de decisão, 01/11/2026)

**Status:** proposta para o Daniel ou o coordenador decidirem. **Nada foi implementado.** Este documento não muda código
nem produção.

**Pergunta:** o e-mail de **confirmação** e o da **véspera** de uma visita por vídeo devem levar o link externo da
chamada (Meet, Zoom, Teams, WhatsApp)? Ou o e-mail leva só o botão para a Viva, onde o link aparece depois do login?

## 1. Como está hoje (main de 01/11, depois do #1892)

| E-mail | Leva o link cru? | O que leva |
|---|---|---|
| Visita confirmada (`avisarVisita`, E325) | não | imóvel, tipo, horário de Brasília e botão para a visita na Viva |
| Véspera, vídeo (`vesperaTexto`, E326 / #1892) | não | botão **"Entrar na chamada"** → `/dashboard/visitas` (exige login) |
| Véspera, presencial | não | botão "Ver a visita" → `/dashboard/visitas` |

- **Onde o link aparece hoje:** só no cartão da visita, depois do login, para as duas partes, enquanto a visita está
  `confirmado`, até o horário + 3 h. A trava é a RLS da 0148, com a leitura feita pelo servidor com a sessão
  (`docs/e290-revisao-link-video.md`).
- **Fim da visita:** quando a visita é cancelada ou concluída, o link é apagado do banco (E290).
- **Quem informa o link:** o dono, ao confirmar ou remarcar. Só são aceitos `https`, sem usuário ou senha, e apenas os
  hosts Meet, Zoom, Teams e chamada do WhatsApp.
- **Produção (só leitura, 01/11):** 3 visitas com link, todas do Meet, 3 links diferentes, 1 dono. Nenhuma sala repetida.

## 2. Prós de pôr o link no e-mail

1. **Um toque a menos na hora da chamada.** A pessoa abre o e-mail da véspera e entra direto, sem login. O código de
   acesso por e-mail leva cerca de 30 s e é o maior atrito no celular.
2. **Funciona com a sessão expirada ou em outro aparelho.** Por exemplo, o e-mail aberto no computador do trabalho.
3. **É o padrão do mercado.** Convites de agenda e confirmações de consulta levam o link.

## 3. Contras e riscos de segurança

1. **O e-mail sai do perímetro da Viva.** Encaminhamento, caixa compartilhada, celular sem bloqueio e prévia na tela
   bloqueada passam a expor a sala. Na tela, o acesso exige a sessão da parte; no e-mail, basta ter a mensagem.
2. **Sala fixa reutilizada.** O dono pode usar a sala pessoal do Meet ou do Zoom em todas as visitas. O E290 apaga o
   link do banco, mas não apaga e-mails já enviados: quem recebeu um link de sala fixa continua com acesso às
   **próximas** visitas daquele dono, com outros interessados. Hoje não há repetição em produção, mas a regra de
   validação não impede.
3. **Um link no corpo do e-mail não pode ser revogado.** Na tela, cancelar ou concluir a visita tira o link na hora.
   No e-mail, ele fica para sempre.
4. **Varredura de links.** Antivírus e filtros corporativos "clicam" nos links do e-mail. Para Meet ou Zoom isso não
   entra na sala, mas pode gerar pedido de entrada e ruído para o dono. Na caixa de testes (`emails_teste`), o link
   seria guardado em texto (o `semLinksComToken` só remove links com token).
5. **Contradiz guardas que já existem:**
   - o E290 tirou o link do e-mail de confirmação;
   - a guarda `src/lib/visitas/e290-link-acesso.test.ts` e o próprio #1892 garantem "sem link cru";
   - pôr o link de volta reabre o que foi decidido nessas revisões.
6. **Privacidade do dono.** Alguns links (sala pessoal do Zoom, link de chamada do WhatsApp) identificam a pessoa ou
   o número dela. A tela limita isso à visita confirmada; o e-mail espalharia.

## 4. Alternativas

| Opção | Atrito | Risco | Esforço |
|---|---|---|---|
| **A. Como está:** e-mail com botão para a Viva (login) | médio (login) | baixo | zero |
| **B.** Link cru no e-mail da véspera e da confirmação | baixo | alto (itens 3.1 a 3.6) | pequeno |
| **C.** Botão no e-mail com **link de uso único da Viva**: assinado, vale só para aquela visita, expira no horário + 3 h e só redireciona para a sala enquanto a visita está `confirmado` | baixo (sem login) | baixo a médio: o link é revogável e expira; quem encaminha o e-mail ainda entra até expirar | médio (rota, assinatura, teste) |
| **D.** A + aviso ao dono para **gerar uma sala nova por visita** (texto no formulário de confirmação) | médio | reduz o risco 3.2 em qualquer opção | pequeno (texto) |

## 5. Recomendação

**Manter A agora e somar D.** Se o atrito do login aparecer nos números (visitas por vídeo confirmadas em que alguém
não entrou), seguir para **C**. **Não adotar B.**

Por quê:
- B troca um segundo de conveniência por um risco que a Viva não consegue desfazer: o link fica no e-mail para sempre
  e a sala fixa vale para as próximas visitas.
- C dá quase a mesma conveniência mantendo a revogação. É o caminho certo se o atrito se confirmar.
- D custa uma frase e corta o risco mais sério, a sala fixa, em qualquer cenário.

**O que a decisão precisa dizer:** (1) A, B ou C; (2) se D entra já. Com C, falta definir a validade do link de uso
único (proposta: até o horário + 3 h, igual ao cartão) e se o link pede um toque de confirmação antes de redirecionar.
