# C11 — banner de topo das páginas institucionais × mockups `publico-*` (Pista A)

Passada elemento por elemento de `/empresas` (real a 1600 px × `publico-empresas-desktop`). Capturas em `docs/capturas/c11/`. Nada foi implementado: a correção é no componente compartilhado `BannerTopo` (10 páginas) e contradiz a ordem `5a4b9146`; aguarda decisão do coordenador, como o E712 aguardou.

| # | Elemento | Mockup | Real hoje |
|---|---|---|---|
| C11-1 | Fundo do topo | bege claro, sem degradê | foto escura em largura cheia com degradê `night/65` |
| C11-2 | Disposição | texto à esquerda, foto na moldura arredondada à direita | texto sobre a foto de fundo, sem moldura |
| C11-3 | Título | "Moradia mobiliada para os profissionais da sua empresa, sem burocracia." (escuro, 3 linhas) | "Moradia de média duração para o seu time" (branco, 2 linhas) |
| C11-4 | Etiqueta | sem "Para empresas" acima do título | etiqueta verde "Para empresas" |
| C11-5 | Apoio | "Residências, transferências e projetos de 30 a 180 dias, com contrato digital e um atendimento só." | parágrafo de 3 linhas sobre contrato formal e pagamento direto |
| C11-6 | Ações | um botão cheio "Fale com a Viva" | dois botões: "Falar com a equipe →" (branco) e "Ver imóveis mobiliados" (contorno) |
| C11-7 | Cartões logo abaixo | 3 cartões ícone + título + texto curto ("Um pedido só para vários profissionais", "Perto da obra, da fábrica ou do hospital", "Nota e recibos organizados para o financeiro") | selo "Mobilidade corporativa" + título "Um lugar para morar, não um quarto de hotel" + 3 cartões com foto |
| C11-8 | Faixa de proposta | "Precisa de uma proposta para sua equipe?" com WhatsApp, e-mail e "Enviar demanda" | ausente; formulário "Fale com a gente" no fim da página |

**Alcance:** o `BannerTopo` serve `/empresas`, `/parceiros`, `/parceiros/avaliadores`, `/parceiros/buscar`, `/precos`, `/como-funciona`, `/para-proprietarios`, `/seguranca`, `/ajuda` e `/ajuda/fale-com-a-viva`. Os mockups `publico-parceiros`, `-precos`, `-como-funciona` e `-proprietarios` seguem o mesmo padrão claro com foto à direita (passadas 8–9 e 89). Alinhar o componente alinha as dez páginas de uma vez; exige atualizar os specs t72, t201, t598, t731, t735 e os testes `c7`, `e458`, `e52`, `seguranca-texto`.

**Pergunta ao coordenador:** vale o mockup (topo claro, texto + foto) ou a ordem `5a4b9146` (largura total, foto de fundo, degradê)? Com a resposta, é um PR de componente único.
