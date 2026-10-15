# Base de conhecimento — padrões de UX do Furnished Finder (ordem f7fecb20)

> Para guiar as ordens **d943f893** (página do imóvel), **19b8abf5** (imagens) e **9f3085d8** (painel).
> Registra **estrutura, hierarquia, componentes e fluxos** — em palavras nossas.
> **Regra permanente:** próximo, nunca cópia. Não copiar texto, layout pixel a pixel, marca, cores
> ou imagens do FF. Nada aqui é para ser colado no site; é para entender o padrão e fazer do nosso jeito (3S:
> simples, sexy e sensacional), sempre em computador **e** celular.

## 0. Fontes e limites (o que foi e o que NÃO foi visto)

| Fonte | Situação |
|---|---|
| Prints do Daniel no Drive, pasta "Furnished Finder" (01–20, 18a/b/c) | Usados: 05–12 e 20 (página do imóvel, celular e computador); 16–18 (busca) já tinham guiado as ordens ca0e7dad/eac7e3a1 |
| Navegação pública (menu do topo, rodapé), lida por navegador automático, sem login | Lida em 15/10 (só a página inicial e a de anunciar) |
| Demais páginas públicas (recursos, estatísticas, pedidos de moradia, sobre) | **Bloqueadas** pela proteção anti-robô do FF após a 1ª página. Não forçamos o bloqueio |
| **Dashboards logados (proprietário e viajante) e a seção de ferramentas do dono** | **NÃO vistos.** O login do Daniel está no navegador do computador dele; esta sessão roda na nuvem e não alcança esse navegador. Ver §6 |
| Pasta `~/workspace/viva-nomads/ff-referencia/` | Fica no computador do Daniel (não existe nesta máquina); **não vai para o GitHub** (instrução do Daniel) |

## 1. Navegação global (site público)

**Topo (computador):** logo à esquerda · 4 entradas no centro · à direita, um botão primário único para o dono
("anunciar") + ícone de menu (hambúrguer) + avatar/entrar.
- As entradas do centro: estatísticas de mercado (com selo "novo"), pedido de moradia, sobre aluguel mensal e
  **um grupo "recursos" que abre um submenu** (recursos do viajante, recursos do dono, central de ajuda, blog,
  perguntas frequentes, app, podcast). → Padrão: **um só nível de cascata no topo**, agrupando conteúdo de apoio.
- Entrar/criar conta ficam dentro do menu do avatar, não como botões soltos.

**Topo (celular):** logo + botão primário "anunciar" + hambúrguer. Nada mais. Busca e filtros vão para a tela.

**Rodapé:** colunas curtas (empresa, conteúdo, app, termos/privacidade) + redes sociais. Sem excesso.

→ **Para a Viva:** já seguimos (cabeçalho limpo na /buscar, CTA único de anunciar, avatar com "Meu painel").
Avaliar no futuro: agrupar Como funciona / Parceiros / Ajuda num submenu "Recursos" se o topo crescer.

## 2. Página do imóvel (prints 05–12, 20) — guia da d943f893

### 2.1 Hierarquia (ordem de leitura)
1. **Galeria no topo**, com contador "n/total", voltar (‹), compartilhar e favoritar sobre a foto.
2. **Abas âncora fixas** logo abaixo (Visão geral · Comodidades · Disponibilidade · Avaliações (n) · Dono).
   Ficam presas no topo ao rolar e a aba ativa acompanha a seção visível (sublinhado). No celular as abas rolam
   na horizontal.
3. **Bloco de identidade:** título (2 linhas no celular), tipo + cidade com ícone de pino, código do imóvel em
   texto pequeno, estrelas + nº de avaliações (link), e uma **lista curta de "sinais de confiança"**:
   tempo de resposta do dono, quando o calendário foi atualizado, nome do dono com avatar de iniciais e
   tempo de casa na plataforma.
4. **Medidas numa linha:** área · quartos · banheiros, separados por ponto.
5. **Destaques do que o imóvel oferece:** 6–8 "pílulas" com ícone (lavanderia, cozinha, etc.) + link "ver todas".
6. **Descrição** com "ler mais" (texto cortado + degradê).
7. **Comodidades completas:** agrupadas por categoria (cozinha, interior, segurança, banheiro…), cada item com
   ícone de traço; no computador, **grade de 3 colunas por grupo e 2 grupos lado a lado**; "ver todas" expande.
8. **Regras da casa:** cartões pequenos (pets, fumar) com ícone + "permitido/não permitido".
9. **Disponibilidade:** título + link "escolher datas" + estadia mínima; faixa verde "calendário atualizado";
   calendário de **1 mês no celular e 2 meses lado a lado no computador**, hoje com contorno e dia
   escolhido preenchido.
10. **Avaliações:** com zero avaliações, um estado vazio convidativo (estrelas apagadas + botão "escrever
    avaliação" — só após a estadia).
11. **Sobre o dono:** nome, tempo de casa, bio com "ler mais".
12. **Mapa aproximado:** abre em tela cheia com **círculo de raio** (nunca o ponto exato) e ícone de casa no
    centro; botão × para fechar.

### 2.2 Barra fixa de preço/contato (print 12)
- **Celular:** barra branca presa embaixo, com puxador; à esquerda **preço/mês grande + status em verde
  ("disponível")**; à direita **um único botão primário** (pedido de reserva/contato). Um botão flutuante
  redondo "+" acima da barra (atalhos).
- **Computador:** o mesmo conteúdo vira um cartão lateral que acompanha a rolagem.

### 2.3 Padrões de botões
- **Um primário por tela** (cor da marca, cantos arredondados médios, texto curto de ação).
- Secundários como **links sublinhados** ("ver todas", "ler mais", "escolher datas").
- Ícones de ação sobre a galeria em **círculos cinza translúcidos**.

### 2.4 O que a Viva já tem × o que falta (para a d943f893)
| Seção | Viva hoje (`imoveis/[id]/property-detail.tsx`) | Falta / melhorar |
|---|---|---|
| Galeria | `PropertyGallery` (principal + miniaturas + ver todas) | contador n/total, compartilhar/favoritar sobre a foto no celular |
| Abas âncora fixas | — | **criar** (seções + aba ativa ao rolar), computador e celular |
| Identidade + sinais de confiança | título, cidade, selos | tempo de resposta, "calendário atualizado", código do imóvel, avatar do dono no topo |
| Destaques | `DestaquesImovel` | conferir 6–8 pílulas + "ver todas" |
| Descrição | `SobreImovel` (Mostrar mais) | ok |
| Comodidades | `AmenitiesGrid` (lista agrupada) | grade por grupo lado a lado no computador |
| Regras | `StayRules` | cartões com ícone |
| Disponibilidade | `AvailabilityCalendar` | 2 meses no computador, faixa "atualizado" |
| Avaliações | `Reviews` | estado vazio convidativo |
| Dono | `OwnerCard` + `OwnerRating` | tempo de casa + bio com ler mais |
| Mapa aproximado | `LocationNearby` / proximidades | **mapa com círculo de raio** em tela cheia (sem ponto exato — já é regra nossa: coordenada ≤ 3 casas) |
| Barra fixa | `BarraFixaCelular` + `PriceCard` | status "disponível" sob o preço; 1 primário só |

## 3. Busca (prints 14–18) — já aplicado
Tela dividida lista + mapa; pins de preço; passar o mouse só destaca; clicar abre cartão ancorado no mapa;
busca compacta no cabeçalho. Aplicado nas ordens ca0e7dad, d15ef6bf, eac7e3a1, 6a98c68e, 65116a07.

## 4. Página "anunciar" (pública)
Estrutura: herói com prova social → bloco de proposta (sem comissão, estadias de 30+ dias) → perfis de
hóspede (4 cartões: viajante a trabalho, saúde, famílias em mudança, professores/estudantes) → passos para
publicar → CTA → depoimentos de donos (carrossel) → perguntas frequentes (acordeão, incl. "quanto custa",
"como funciona o pagamento", "como funciona a reserva"). Um formulário curto de início no topo.
→ Nossa /para-proprietarios já segue a mesma lógica (ordem 5a4b9146).

## 5. Fluxos principais observáveis sem login
- Viajante: busca → imóvel → **pedido de reserva/contato** (o FF não processa pagamento do aluguel; o
  combinado é entre as partes). Avaliação só depois da estadia.
- Dono: "anunciar" → cadastro → anúncio; assinatura anual do dono (sem comissão por reserva).

## 6. Dashboards logados e seção de ferramentas — PENDENTE
Não foi possível ver nesta sessão (ver §0). Para completar esta parte há dois caminhos, sem passar senha:
1. Rodar a sessão no computador do Daniel (app Claude Desktop ou `claude remote-control` na pasta do projeto),
   onde o navegador já está logado; ou
2. O Daniel gravar/printar cada tela do painel (dono e viajante), com os menus abertos e fechados, e subir na
   pasta "Furnished Finder" do Drive.

O que registrar quando houver acesso (checklist):
- [ ] Menu lateral do dono: grupos, subitens (cascata), ordem, contadores, item ativo.
- [ ] Seção de ferramentas do dono: lista de ferramentas, como são agrupadas, CTA de cada uma, o que é pago.
- [ ] Painel do viajante: pedidos, favoritos, mensagens, documentos, perfil.
- [ ] Padrões de estado vazio, tabelas/listas, filtros e paginação dentro do painel.
- [ ] Celular: como o menu lateral vira gaveta/abas.

Enquanto isso, a parte 1 do painel (PR #503) usa o padrão de **menu em cascata com grupos** e a seção
**Ferramentas** como grupo próprio — a ser refinada quando o §6 for preenchido.
