# E816 — a disponibilidade abria com a entrada pré-marcada

**Achado** (RELATORIO-011). A página abria mostrando "Entrada 01/12/2026 — agora escolha a saída." (ube-003; no
ube-001, 03/12/2026), como se a moradora já tivesse escolhido.

**Causa.** É o "pedido pré-preenchido" (ordem 8302024d / E517): a página lê a última busca guardada no aparelho
(`localStorage`) e, se a data couber no anúncio, já marca a entrada. Quem testa no mesmo navegador há dias herda uma
data antiga. A tela usava a mesma frase da escolha feita na página.

**Correção.** A pré-seleção continua, mas não se disfarça de escolha.
- A entrada da busca entra marcada (`comEntradaDaBusca` → `entradaDaBusca: true`).
- O resumo do calendário diz "Entrada 01/12/2026, da sua última busca (não escolhida aqui). Escolha a saída ou toque em
  outra data para trocar." (`textoDaSelecao`).
- Aparece o botão **Limpar a data** (`semDatas`), que volta ao estado sem escolha e mantém as pessoas.
- Qualquer escolha na página (clique no calendário ou campo de entrada) tira a marca. Aí volta a frase
  "Entrada … — agora escolha a saída."

**Teste.** `src/lib/imovel/e816-entrada-da-busca.test.ts` (4): falha na main (os exports não existem) e passa na
branch.
- O texto diz a origem.
- A escolha manual tira a marca.
- Limpar volta ao vazio.
- A página e o calendário usam as funções novas.
