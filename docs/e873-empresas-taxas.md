# E873 — /empresas omitia todas as taxas

**Achado (RELATORIO-021, A-106):** nenhum percentual em /empresas: nem 12%, nem 10%/8%/6%, nem o Gestor 4% a partir de 20 imóveis. Só "a taxa da Viva é do proprietário".

## Correção
- `src/lib/empresas-taxas.ts`, da fonte única `FAIXAS_COMISSAO_PADRAO` (`lib/cobranca/regra.ts`):
  - `linhasTaxaEmpresas()`: 1–2 imóveis 12%, 3–5 10%, 6–15 8%, 16–19 6%, 20+ Plano Gestor 4%;
  - `FRASE_TAXA_EMPRESAS`: quem paga (o proprietário), sobre o quê (valor total do contrato fechado), a faixa, o Gestor, e que quem vem morar não paga.
- /empresas: seção "Taxas da Viva" (`data-testid="empresas-taxas"`) com a frase e a tabela. O FAQ "Qual é o prazo de resposta e a taxa?" passa a usar a mesma frase. Nenhum percentual digitado à mão na página.

## Testes
- `node --test src/lib/e873-empresas-taxas.test.ts`: main pass 0 / fail 1 (o módulo não existe); branch pass 3 / fail 0.
- Escopados (testes que leem /empresas, cobrança, frases proibidas, estilo): 0 falhas. tsc limpo; consistência OK.
- Lab (build da branch): t72 + t18 → 28 passed, 1 skipped; o HTML de /empresas tem as 5 linhas.

## Asserções alteradas
- `src/lib/empresas-pagina.test.ts` (E770): a frase antiga "A taxa da Viva é do proprietário, por contrato fechado" vira a da fonte única ("A taxa de serviço da Viva é paga pelo proprietário, sobre o valor total do contrato fechado…").
