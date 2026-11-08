# E679 — PR 4: avaliações nos perfis públicos

Mockups: `docs/mockups-avaliacoes/avaliacoes-perfil-proprietario-*.webp` e `avaliacoes-perfil-parceiro-*.webp`. Capturas do bloco a 390 e 1280 px (dados de exemplo): `docs/capturas/e679-perfis/`.

## O que mudou
- **Um bloco só para os dois perfis** (`PerfilAvaliacoes`): "Avaliações recebidas" com um cartão por avaliação (inicial, nome curto · mês e ano, estrelas, comentário, **"Resposta de …"** com a barra verde) e, à direita, o **"Resumo das notas"**: a média de cada critério em barras, com "Baseado em N avaliações". No celular o resumo desce para depois das avaliações.
- **Proprietário** (`/proprietario/[id]`): critérios do morador (imóvel como no anúncio · limpeza na chegada · comunicação). O nome de quem avaliou vem curto ("Camila A.").
- **Parceiro** (`/parceiros/[slug]`): ganha o bloco de avaliações dos clientes (qualidade · pontualidade · cuidado com o imóvel) e a **faixa âmbar**: "As notas que a LimpaLar dá aos clientes são visíveis só entre parceiros e não aparecem aqui." A leitura (`getAvaliacoesDoParceiro`) pega **só** `papel_autor = 'cliente'` e `status = 'publicada'`: a nota do parceiro ao cliente nunca entra na página pública (guarda em teste).
- A média por critério só conta quem avaliou aquele critério; critério sem nota mostra "—" e barra vazia (não inventa 0).
- **Sem migração.** Lê `notas_categorias` (já público para o que está publicado, 0089/0323) e as respostas de `avaliacao_respostas`.

## Diferenças conhecidas
1. O cabeçalho do perfil (nota média grande e "N avaliações de moradores") segue o desenho atual do perfil (selo, linha "desde …", nota ao lado do nome); o mockup põe a média grande no cartão do topo. Fica como acabamento do cabeçalho, sem mudar dados.
2. Sem o botão "Responder" na página pública (o mockup o mostra logado, para o próprio avaliado; ele responde pela página própria do PR 3).
3. Fundo claro padrão da casa (E166).
