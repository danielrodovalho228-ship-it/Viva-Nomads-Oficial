# E679 — PR 1: painel Avaliações unificado (resolve a duplicação do E85)

Mockup de referência: `docs/mockups-avaliacoes/avaliacoes-painel-desktop.webp` e `-mobile.webp`. Capturas (390 e 1280 px, com dados de exemplo; o painel real exige sessão): `docs/capturas/e679-painel/`.

## O que mudou
- **Um só painel, um só nome, um só destino:** `/dashboard/avaliacoes`, com as abas **Para avaliar (N) · Recebidas · Feitas**. A rota antiga `/dashboard/conta/avaliacoes` só redireciona (`?aba=recebidas`, mantendo filtro e busca). O menu lateral e o menu da Conta apontam para o mesmo destino.
- **Para avaliar:** cartões "Avalie sua estadia — imóvel" (morador) e "Avalie o morador — imóvel" (dono), "Contrato encerrado em 10 de novembro", selo "Faltam N dias" (prazo = fim do contrato + 14 dias, o da migração 0089), botão "Avaliar agora" (leva ao formulário da estadia), faixa de sigilo e "Recebidas recentes" com "Responder".
- **Recebidas:** a lista da antiga tela da Conta (filtros Todas/Recentes/Positivas, busca, Responder, Pedir revisão), mesmos `data-testid`.
- **Feitas:** minhas avaliações com o estado (Aguardando a outra parte · Publicada · Em análise). Nunca diz se a outra parte já enviou.
- Sem migração: lê `avaliacoes` (RLS do autor), contratos e locações que já existiam. `ContratoView` não mudou; o fim do contrato vem de `fimParaAvaliacao`.

## Diferenças conhecidas em relação ao mockup
1. **Foto do imóvel nos cartões:** os dados de locação/contrato não trazem a foto de capa; o cartão usa o ícone de casa. Para a foto, falta uma leitura da capa por imóvel (PR seguinte).
2. **Cartão "Avalie o serviço — LimpaLar Serviços":** a avaliação de serviço (cliente × parceiro) tem tabela própria (`parceiro_avaliacoes`) e depende da Pista B para a lista de serviços concluídos. Entra no PR de "avaliar serviço".
3. Fundo bege do mockup: o painel segue o fundo claro padrão da casa (E166).

## Próximos PRs do E679
2. Formulário de estadia (critérios, etiquetas, recomendaria) igual aos mockups; 3. Responder + texto "o avaliado responde"; 4. Perfis públicos do proprietário e do parceiro; 5. Avaliar serviço.
