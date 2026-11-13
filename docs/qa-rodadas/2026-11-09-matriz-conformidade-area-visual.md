# Matriz de conformidade mockup × tela — área visual (Pista A), 09/11/2026

Escopo: telas mexidas por esta pista. Estado = o que o código do PR entrega; **prova** = o que o QA ainda confere (390/1280 px, logado). Os arquivos dos mockups **não estão no repositório**; a coluna "mockup" cita o nome registrado nos itens e na `docs/matriz-conformidade-mockups.md`.

| Tela | Elemento | Mockup / padrão | Estado no PR | Prova pendente |
|---|---|---|---|---|
| /buscar (celular) | faixa de filtros (chips) | BUSCA-CARD: uma linha de controles, íntegra | sticky abaixo do cabeçalho, chips inteiros (#3611) | 390 px rolando |
| /buscar (celular) | Mais filtros · Ordenar · Mapa | mesma linha, sem deslocar | presos junto da faixa, sem layout shift (#3611) | 390 px |
| /buscar (cartões) | rótulo do total | "Total por mês" | "Total por mês, sem IPTU" (#3583) | 390/1280 |
| /buscar (cartões) | selo "Anúncio de exemplo" | posição única | mesclado (#3497) | — |
| Anúncio | abas de seção | abas presas abaixo do cabeçalho | rolagem por código + sync (#3610) | 390, aba por aba, exemplo e real |
| Anúncio | nota e cartão do proprietário | uma fonte por nota | "do proprietário, em todos os imóveis" (#3584) | 390 |
| Anúncio | comodidades | um ícone por comodidade | ícones para pets/acessível/quintal (#3666) | 390/1280 |
| Anúncio (reserva) | aviso de exemplo | aviso primeiro, no topo | #3498 | 390 |
| Anúncio | "R$ X em N meses" | resumo único | `resumoEmMeses` (#3599) | 390/1280 |
| Avaliações | voltar + título | padrão da tela de papéis: seta + título em tinta | seta junto do título, título tinta (#3617) | 390 lado a lado com o print |
| Avaliações | abas | sublinhadas (decisão do Daniel, 09/11) | sublinhadas (#3617) | 390 |
| Avaliações | título de seção | sem duplicar a aba ativa | removido (#3617) | 390 |
| Papéis | cidade | "Uberlândia" | grafia oficial (#3617) | 390 |
| Cabeçalho (Conta) | avatar | foto; iniciais só sem foto | foto em todas as rotas (#3618) | logado, 390, telas principais |
| Admin (celular) | "‹ Voltar ao site" | última página pública; entrada direta → home | #3620 | 3 caminhos, 390 |
| /empresas | rótulo do banner | contraste ≥ 4,5:1 | `text-white/90` sobre pastilha (#3530) | 1280 |
| /empresas | prazo, taxa, escopo do dinheiro | prazo de 7 dias | FAQ + passo 1 (#3586) | 390 |
| /parceiros | taxas, categoria Avaliação, portfólio | rótulos claros | #3578, #3577, #3644 | 390 |
| Campos de formulário | borda | contraste 3:1 | #3537 | 390 |
| Todas as páginas | primeiro Tab | "Pular para o conteúdo" | #3536 | 1280, teclado |
| Mais filtros | Esc | foco volta ao botão | #3533 | teclado |
| Telas do imóvel (painel) | voltar | um só, do cabeçalho padrão | #3535, #3589 | 390 |
| Home (topo/hero/busca) | cabeçalho | **não muda** (decisão do Daniel, 08/11) | sem alteração (#3460 só registra) | — |
