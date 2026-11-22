# E906 — remissões da Ajuda e dos guias viram links (com o E836 no "Quanto custa anunciar?")

**Defeito:** respostas da Central de Ajuda e os guias citavam caminhos em texto simples ("a busca é em /parceiros/buscar", "/empresas", "crie a conta em /auth", "leia /seguranca"), sem link.

**Correção:**
- `pedacosComRemissoes(texto)` (`src/lib/ajuda/remissoes.ts`, puro) separa o texto e marca como link só os destinos vivos: /parceiros/buscar, /parceiros/fotografos, /parceiros, /empresas, /auth, /seguranca. Os caminhos mais longos têm prioridade. Um caminho que continua (ex.: /parceiros/avaliadores) e /precos ficam como texto.
- `TextoComRemissoes` (`src/components/ajuda/texto-com-remissoes.tsx`) desenha os pedaços na resposta da Central de Ajuda e nos parágrafos dos guias. O texto lido não muda.
- **E836 (feito junto):** a frase "Veja a comparação com outras opções em /precos." sai do artigo "Quanto custa anunciar?". A página de preços está suspensa; o link estruturado `LINK_PRECOS` continua governado pela chave.

**Onde aparecem os links:**
- "Como contratar um fotógrafo": /parceiros/buscar e /parceiros/fotografos.
- "Como virar parceiro": /empresas, /parceiros e /auth.
- Guias: /seguranca, em dois parágrafos.

**Teste:** `src/lib/ajuda/e906-remissoes-links.test.ts` (5 casos), vermelho na main e verde na branch.
