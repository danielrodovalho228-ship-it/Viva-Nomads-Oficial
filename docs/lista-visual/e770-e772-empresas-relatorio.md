# Lote 08/11 (noite): CI dos rascunhos + /empresas (E770, E771, E772)

## CI dos rascunhos
- #3583 E767, #3584 E769, #3585 E773: sem falha no momento da checagem (lab-critico/verify/e2e em andamento).
- #3574 E757: `verify` falhou — `parceiros/e649-textos-cnpj.test.ts` ainda exigia o texto antigo "Identidade e CNPJ; para fotografia…". Teste atualizado no próprio PR.
- #3578 E763: `verify` falhou — guarda de vocabulário (`parceiros/regras.test.ts`, item 8) barrou "COMISSAO" no nome `FAIXAS_COMISSAO_PADRAO` dentro de `taxas-texto.ts`. Passei a ler as faixas por `faixaPorImoveisAtivos`. Corrigido no próprio PR.
- #3577 E758: sem falha.
- Causa comum: eu rodei só o teste do módulo; os dois guardas são de OUTROS módulos. Antes de empurrar, rodar também os testes que leem a mesma página/pasta.
- A "1 falha do lote de comandos" do E769: chamei a ferramenta `bash` (minúscula) em vez de `Bash`; a chamada nem executou ("No such tool available: bash") e repeti com `Bash`. Nada a ver com o código.
- Constante `ROTULO_TOTAL_MES` de `precos.ts` ("Total por mês (com contas)"): intocada, pendente de decisão.

## E764
Já está na `main` (#3569). Nada a fazer.

## E770 / E771 / E772 (/empresas, /parceiros) — um PR só, pois mexem no mesmo arquivo
- E770: FAQ nova "Qual é o prazo de resposta e a taxa?": não há prazo definido para empresas (resposta por e-mail); a taxa da Viva é do proprietário, por contrato; morador não paga taxa; sem mensalidade. Passo 1 deixou de dizer "Respondemos". **Decisão do Daniel:** se quiser prometer prazo (ex.: 1 dia útil como em /parceiros), é só trocar a frase.
- E771: /empresas diz "pagamento da estadia vai direto ao proprietário… serviços de parceiros são contratados à parte, com regra própria"; /parceiros (Regras claras) ganhou "A divisão vale só para os serviços de parceiros; o pagamento da estadia vai direto ao proprietário" (`ESCOPO_PAGAMENTO_PARCEIROS`).
- E772: "Uma fatura por estadia" já não existe no código: a página fala em recibo mensal emitido pelo proprietário (FAQ) — coberto. "Relatórios (em construção)" saiu (cartão, descrição SEO e JSON-LD); grade ficou com 2 pilares.
