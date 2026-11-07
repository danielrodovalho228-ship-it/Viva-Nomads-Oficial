# E679 — PR 5: avaliar o serviço (cliente) e o cliente (parceiro)

Mockups: `docs/mockups-avaliacoes/avaliacoes-avaliar-servico-cliente-*.webp` e `avaliacoes-avaliar-servico-parceiro-*.webp`. Capturas a 390 e 1280 px (dados de exemplo): `docs/capturas/e679-servico/`.

## O que mudou
- O painel "Avalie o serviço" / "Avalie o cliente" da tela do pedido (`/dashboard/servicos/pedidos/[id]`) passa ao desenho dos mockups:
  - **cabeçalho do serviço:** "Limpeza — LimpaLar Serviços" (cliente) ou "Ricardo M. · Cliente" (parceiro), com "Serviço concluído · Pedido VN-SV-… · R$ 280";
  - **faixas:** a âmbar **"Nota entre parceiros: esta avaliação aparece só para outros parceiros. Ela não fica no perfil público do cliente."** (só para o parceiro) e a de sigilo "Sua avaliação é secreta por enquanto: ela só aparece quando os dois avaliarem, ou em 14 dias.";
  - **nota geral em estrelas grandes** e os três critérios do par com estrelas à direita (cliente: qualidade · pontualidade · cuidado com o imóvel; parceiro: comunicação · imóvel pronto para o serviço · combinado cumprido). Antes eram botões numerados;
  - "Destaques do serviço" / "Selecione tags que descrevem o cliente"; "Conte como foi o serviço" / "Algum comentário sobre o atendimento?" com contador n/500; "Você contrataria de novo?" / "Você receberia este cliente de novo?" (Sim/Não); botão cheio "Enviar avaliação".
- Os `data-testid` dos specs seguem (`pedido-nota-N`, `pedido-criterio-…`, `pedido-recomendaria-sim/nao`, `pedido-avaliar`, `pedido-avaliacao-texto`), e cada estrela de critério ganha `pedido-criterio-<chave>-<n>`.
- **Sem migração:** o modelo (critérios, etiquetas, recomendaria, janela de 14 dias, publicação cega, nota do parceiro ao cliente só entre parceiros) é o da Pista B (0322/0323), já em produção na ação `avaliarPedido`.

## Diferenças conhecidas em relação ao mockup
1. **Data da conclusão** ("concluído em 11 de novembro") e **ícone/foto do serviço**: o detalhe do pedido não traz a data de conclusão nem a capa; a linha diz "Serviço concluído · Pedido … · R$ …".
2. "Combinado cumprido" (rótulo da lista de critérios da Pista B) aparece como "Pagamento combinado cumprido" no mockup; mantive o rótulo da lista.
3. Os recados privados (parte e Viva) não aparecem no mockup; ficam recolhidos em "Recados privados (opcional)".
4. Fundo claro padrão da casa (E166).
