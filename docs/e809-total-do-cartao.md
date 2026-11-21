# E809 — "R$ 4.140 em 2 meses" × composição de R$ 7.140 (cartão São José)

**Relato** (RELATORIO-011, "primeira visita" da busca). O cartão "São José" dizia "R$ 3.300/mês · R$ 4.140 em 2 meses",
mas a composição "2 × R$ 3.300 + limpeza de preparação R$ 300 + limpeza de saída R$ 240" soma R$ 7.140.

**Dado-fonte (13/11/2026).** O anúncio **nunca existiu**:
- **Banco de produção:** `properties` sem nenhuma linha com "São José" no título ou no endereço, nem com
  `monthly_price = 3300`.
- **Código:** nenhum exemplo em `src/lib/properties.ts` com esse bairro ou esses valores, e nenhum commit do repositório
  (`git log --all -S'"São José"'`).
- **Mesmo conjunto fantasma do E810:** é a "primeira visita" do relatório, com São José, Martins, Laranjeiras, Tubalina
  e outros bairros que não existem na aplicação.

Não foi "corrigido" nem "saiu do conjunto": nunca esteve no site.

**A classe de erro já está fechada** (E756/E777). No cartão (`property-card.tsx`), o cabeçalho
(`estadiaCartao.texto`) e a composição (`estadiaCartao.composicao`) saem do mesmo objeto, `estadiaNoCartao` →
`estadiaDoImovel`, a mesma conta da página. Não há como um sair diferente do outro.

**Prova ligada** `src/lib/e809-total-do-cartao.test.ts` (3, verdes na main e na branch):
1. **Todo cartão** (15 exemplos × 1 a 6 meses): a soma da composição escrita = o total, e o cabeçalho traz esse total.
2. **O caso relatado**, montado com os números dele: R$ 3.300, 2 meses, preparação R$ 300 e saída R$ 240 dão
   R$ 7.140 no cabeçalho e na conta. R$ 4.140 nunca aparece.
3. **O cartão** desenha o cabeçalho e a composição do mesmo objeto.

A guarda antiga do E756 conferia só ube-001/002/003; esta estende a todos os cartões.
