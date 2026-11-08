# E679 — PR 2: formulário de avaliar a estadia, igual aos mockups

Mockups: `docs/mockups-avaliacoes/avaliacoes-avaliar-morador-*.webp` e `avaliacoes-avaliar-proprietario-*.webp`. Capturas a 390 e 1280 px (dados de exemplo): `docs/capturas/e679-formulario/`.

## O que mudou
- **Página própria por estadia:** `/dashboard/avaliacoes/avaliar/[contratoId]`, o mesmo endereço para os dois lados. "Avalie sua estadia" (morador avalia o proprietário) e "Avalie o morador" (proprietário avalia o morador). Cartão com a estadia (imóvel, cidade, "Estadia de 12 de agosto a 10 de novembro", "Proprietário: Ricardo M." ou "Camila A. · Morador"), faixa de sigilo e o formulário já aberto. Só quem é parte do contrato vê (leitura pela sessão); de outra pessoa, 404. O "Avaliar agora" do painel leva para cá.
- **Formulário (mockup):** "Como foi, no geral?" com estrelas grandes; os três critérios do par com as estrelas à direita (morador: imóvel como no anúncio · limpeza na chegada · comunicação; dono: cuidado com o imóvel · regras da casa · comunicação); "Tags rápidas" (morador) e "Destaques da estadia" (dono); "Conte para futuros moradores/proprietários" com contador 0/500; "Você recomendaria esta estadia?" / "Você receberia esta pessoa de novo?" com Sim/Não; botão cheio "Enviar avaliação".
- **Sem edição depois de enviar:** quem já avaliou vê "Você já avaliou esta estadia" e o caminho para as Feitas.
- Os cartões de Minhas locações e Contratos usam o mesmo formulário (mesmos papéis, rótulos e placeholders de antes), então ganham o mesmo visual.
- **Sem migração.** Usa critérios, etiquetas e "recomendaria" que a Pista B já entregou (0322/0323).

## Diferenças conhecidas em relação ao mockup
1. **Foto do imóvel** no cartão da estadia: não há capa nos dados da estadia; usa o ícone de casa (mesma lacuna do PR 1).
2. **"Recomendaria" é Sim/Não, não um interruptor ligado:** a resposta nasce vazia e o envio exige escolher. Um interruptor já em "Sim" pré-responderia por quem avalia.
3. **Recados privados** (para a outra parte e para a Viva) não aparecem no mockup; ficam recolhidos em "Recados privados (opcional)". Se a decisão for tirar do formulário, é remover esse bloco.
4. **Pergunta final neutra** ("esta pessoa"), sem presumir gênero (o mockup diz "esta moradora").
5. Fundo claro padrão da casa (E166), não o bege do mockup.

## Próximos PRs do E679
3. Responder + texto "o avaliado responde"; 4. Perfis públicos do proprietário e do parceiro; 5. Avaliar serviço.
