# E813 — a caução sem a base explícita

**Achado.** RELATORIO-011 e RELATORIO-013:
- **Base implícita:** a nota da caução dizia "50% do valor de cada bloco, no máximo 3 vezes o valor mensal". A moradora
  tinha de deduzir dos números que a base é só o valor mensal: ube-001, R$ 1.600 = 50% de R$ 3.200; ube-002, R$ 1.200
  = 50% de R$ 2.400; ube-003, R$ 4.100 = 50% de 2 × R$ 4.100.
- **Superfícies desalinhadas:** a regra completa só aparecia dentro do anúncio; a home dizia apenas "Caução documentada".

**Regra no código.** `caucaoDoBloco(monthlyPrice × meses do bloco)`: 50% do aluguel por mês do bloco. Condomínio e
contas ficam de fora. O teto é de 3 aluguéis no contrato (`REGRAS_CONTRATO`).

**Correção: frase única em `src/lib/faixas.ts`**, com os números de `REGRAS_CONTRATO`:
- `CAUCAO_BASE`: "50% do valor mensal (só o aluguel, sem condomínio nem contas) por mês de cada bloco, no máximo 3
  vezes o valor mensal no contrato".
- `CAUCAO_REGRA`: "A caução é de {CAUCAO_BASE}." Usada em /como-funciona e /para-proprietarios.
- `CAUCAO_CURTA`: "Caução de 50% do valor mensal por bloco". Usada na faixa de confiança da home, no lugar de
  "Caução documentada".

**Onde mais a frase entra:**
- `NOTA_CAUCAO`, a nota da linha "Caução" no anúncio, passa a começar pela base.
- `src/lib/seo/llms.ts` usa a mesma base.

`CAUCAO_FRASE`, a frase de "Caução de até 3 vezes…" validada no jurídico, **não muda**. A base é dita na frase seguinte.

**Testes.**
- `src/lib/e813-caucao-base.test.ts` (3): falha na main (o export não existe) e passa na branch. Confere a frase
  exata, os números dos 3 exemplos contra a regra e as superfícies que usam a frase única.
- Asserções alteradas:
  - `home-imagens.test.ts`: o selo da caução lê `CAUCAO_CURTA`.
  - `reserva-imovel.test.ts`: a nota passa a ter a base escrita.
  - `tests/e2e/specs/t217-home-busca-3s.spec.ts`: o texto da faixa de confiança muda.
