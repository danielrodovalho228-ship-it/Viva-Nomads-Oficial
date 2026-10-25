# E176-IMPL — Especificação dos menus (aprovada)

Fonte: texto da coordenação (Muse) do qual os mockups "mockups-da-proposta-de-menus-viva-nomads" foram gerados. O Daniel
aprovou todos os mockups em 25/10 ("Todos os mockups aprovados"), decidindo D1–D3 pelo desenho. As sessões do Code não
alcançam o artefato; esta é a especificação completa e aprovada, guardada aqui para viver onde as sessões alcançam. O QA
final compara tela a tela com os mockups.

## Visual
- Fundo CLEAN (sem bege/creme), verde da marca `#1C6B3A`, padrão 3S.

## D1 — Barras por papel
- **Morador (celular, 5 itens):** Início · Buscar · Pedidos · Mensagens · Estadia — Estadia SEMPRE visível (mesmo sem
  estadia ativa; sem estadia, a aba mostra estado vazio com caminho para buscar).
- **Morador (desktop):** as mesmas 5 como ABAS no topo.
- **Dono (desktop e celular, mesmos 5 nomes):** Início · Anúncios · Interessados · Contratos · Mensagens.
- **Contratos** ganha a sub-aba **Ganhos** (inexistente hoje).

## D2 — Menu do avatar
- Atalho curto, 4 itens SÓ: Minha conta · Modo proprietário (ou "Modo morador", conforme o papel) · Ajuda · Sair.
- Nada de espelhar a Conta inteira; "Sair" aparece UMA vez só por tela.

## Nomes únicos por destino (todos os menus)
- "Anunciar" com um nome só.
- Na Conta valem "Pagamentos", "Perfil", "Privacidade" (nada de "Pagamentos e recebimentos"/"Perfil e dados"
  paralelos — resolve o E85 junto).
- "Notificações" é uma página só; "Avaliações" unificado.

## Voltar
- Padrão único: link "← <lista>" no TOPO das telas de detalhe (contrato, estadia, fechamento, filhas da Conta).
- Listas e páginas da Conta: sem voltar (a navegação é a aba/barra).
- Fechamento perde o botão "Voltar" do fim do formulário e ganha o link no topo.
- Admin mantém "‹ Voltar ao site".

## Topo público (PUBLICO-A)
- Imóveis · Anunciar · Empresas + "Fale com a Viva" em texto + Entrar.
- O cabeçalho NÃO some na /buscar (logo/conta/menu persistem, como no Furnished Finder).
- /auth ganha saída rotulada (logo clicável).

## D3 — Admin no celular
- Navegação ÚNICA = hambúrguer → gaveta. Some o botão "Menu da equipe" e qualquer terceiro caminho.
- O alerta de backup aparece UMA vez só, dentro de "Precisa da sua atenção" (sai a faixa vermelha duplicada).
- Cartões da grade do admin com altura uniforme.

## Papel persiste
- Morador que vai à área pública e volta NÃO vira dono em silêncio.
- Visitas do morador mostram conteúdo do morador (nada de "Pedidos nos meus imóveis").

## Conta
- Segurança e verificações ganham item próprio na Conta.
- "Ver minhas estadias" leva a uma lista de estadias de verdade.
