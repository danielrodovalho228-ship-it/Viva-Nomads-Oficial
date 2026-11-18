# Frente 3, área mapa/página pública (t112, t692, t839, t840)

O índice geral está em `docs/frente3-regressoes.md`, no PR da busca/home. Todos os specs desta área foram reproduzidos no laboratório local, igual ao do CI.

| Spec | Falha no lab | Causa (com prova) | Classe | Ação |
|---|---|---|---|---|
| t112 (1440/390) | `/para-proprietarios: repetida na página /images/unicas/prop-passo-anuncie.webp` | **E718** (`ae46d5e9e`, 08/11) pôs no bloco "Publicamos para você" a mesma foto do passo "Anuncie de graça" da mesma página. A regra das imagens únicas (ordens 19b8abf5 e de7b27fd) proíbe. | **Regressão de código** | O bloco fica sem foto (texto e botão continuam). Não sobra nenhuma imagem no acervo que não repita outra página; pedido de foto própria nas Dúvidas. |
| t839 (390) | "Fechar recebe o clique": `false` | **E780** (`ca92902af`, 09/11): a faixa de filtros da busca no celular ficou presa (uma `div` sticky). O `mostrarCartaoNaTela` só descontava `header`/`nav`, então o topo do cartão (o "Fechar") ficava sob a faixa. Prova no lab local: `344e3a273` (anterior) **1 passed**; `ca92902af` **1 failed**. | **Regressão de código** | `SELETOR_BARRAS_FIXAS = "header, nav, [data-barra-fixa]"`, e a faixa do E780 se marca `data-barra-fixa`. |
| t840 (390) | pins "R$ 3.200" sobrepostos | Limite do **E525**: no máximo 8 anéis e o pin não sai do quadro. A massa do lab põe dezenas de anúncios na mesma coordenada ("Centro"); num mapa de 390 px as posições livres acabam. No CI alterna (passa e falha no mesmo intervalo de commits) conforme a massa da fatia. | **Instável por massa / limite do desenho** | Sem mudança; precisa de decisão (Dúvidas). |
| t692 (390) | erro vazio no relatório | Alterna no `lab_execucoes`. Passou no lab local. | **Instável** | Sem mudança; segue observado. |
