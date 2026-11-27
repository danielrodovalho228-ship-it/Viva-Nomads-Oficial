# E814 — título "premium" com nível Essencial

**Achado** (RELATORIO-011): o ube-002 se chamava "Studio premium no Centro" e o nível mostrado é Essencial, o mais
baixo. Título e nível contavam histórias opostas. Mesmo caso no ube-014: "Imóvel mobiliado de 3 quartos premium".

**Regra** (`src/lib/anuncio/titulo-nivel.ts`, pura). O título não usa o nome de um nível diferente do nível
**calculado** do anúncio:
- "premium" só com nível Premium;
- "conforto" (a palavra inteira; "confortável" não conta) só com nível Conforto;
- sem nível calculado (anúncio novo ou em adequação), nenhum termo de nível.

**Correção.**
1. **Exemplos:** sai "premium" dos títulos do ube-002 ("Studio no Centro, ideal para estadia profissional") e do
   ube-014 ("Imóvel mobiliado de 3 quartos — Cidade Jardim"). Os dois são Essencial. O orçamento de demonstração
   (`documents.ts`) e o padrão de `api/test-lead` acompanham.
2. **Fluxo real:**
   - O bloco de consistência do título (`avisosConsistenciaTitulo`, no Passo 7 do assistente e no editor) mostra o
     aviso.
   - O **servidor recusa**. `createProperty` recusa qualquer termo de nível, porque o anúncio novo ainda não tem nível.
     `updateProperty` recusa termo diferente do nível lido em `imovel_nivel`. Mensagem: 'O título diz "premium", mas o
     nível do anúncio é Essencial. O nível é calculado pela Viva: tire "premium" do título.'

**Teste.** `src/lib/anuncio/e814-titulo-nivel.test.ts` (4): falha na main (3 de 4) e passa na branch.
- Nenhum exemplo com termo de nível divergente.
- A regra (premium/conforto/"confortável"/sem nível).
- O aviso do editor.
- A trava nas duas ações do servidor.

**Limite.** Se o nível **cair** depois (item que não confere), um título já gravado com "premium" fica divergente até
o próximo salvar, quando o servidor recusa. Ver Dúvidas no PR.
