# Frente 3, área admin (t81, t227, t229, t231, t273, t290)

O índice geral está em `docs/frente3-regressoes.md` (PR #3734). Reproduzido no laboratório local igual ao do CI, com sessão de admin e TOTP do `seed-lab`.

| Spec | Falha no lab | Causa (com prova) | Classe | Ação |
|---|---|---|---|---|
| t227 (2: fila de falhas) | `documentos_fiscais` sem o recibo do 2º contrato (`.numero` de nulo) | **E546** (`009951373`, #2546, trabalho meu de 05/11): a guarda contra recibo em duplicidade comparava o imóvel pelo **texto do endereço**. O spec usa dois imóveis **diferentes** do mesmo dono, com o mesmo endereço em texto ("Centro, Uberlândia/MG"); o 2º recibo, legítimo, foi barrado como "registro em duplicidade". Prova: `git bisect --first-parent` no lab local, do último verde `9fb613551` (passa) até a main (falha). Primeiro ruim: `009951373`. | **Regressão de código** | A guarda compara pelo **imóvel do contrato** (`property_id`); o texto do endereço vale só para documento antigo sem imóvel. O caso do E546 (mesmo imóvel, contratos refeitos) segue barrado. |
| t81 (admin) | botão "Administração" não existe | **ADMIN-1** (`a2af79592`, 25/10): barra do admin em grupos (`config/menu-admin.ts`); "Documentos" em "Anúncios e pessoas", "Caixa dos Sócios" em "Equipe". A nova barra é coberta pelo t460. | Spec desatualizado por decisão | Reescrito com os grupos do ADMIN-1, mantendo a intenção (separado, grupos com itens dentro, item atual, outro grupo abre). |
| t229, t231, t273 | `admin-decisoes` não existe | **E330** (`1c49d599a`, 01/11): "Sai o topo 'Hoje você tem N decisões' separado da fila"; a Central conta no título a fila inteira. **E474** (`77e0ff4e4`, 05/11): decisões das outras telas uma vez na Central. Já registrado em `docs/e744-triagem-falhas.md`. | Spec desatualizado por decisão | Reescritos contra a Central atual: filtros `central-filtro-<chave>` e decisões das outras telas `central-linha-decisao`. A linha de decisão passa a expor `data-n`, como o botão de filtro. Mesmas verificações: o título é a soma, e cada número abre a lista que conta o mesmo. |
| t231 (390) | Central 2 × lista 1 (só com outro spec em paralelo) | Contagem global: o t273, em paralelo, cria e apaga a própria candidatura parada. Sozinho: 7/7. | Corrida entre specs | Relê a Central e abre a lista logo em seguida, com nova tentativa (`toPass`), o mesmo padrão do t229. |
| t290 | `goto … networkidle` estoura 90 s | Pré-carregamentos RSC da home (links da barra) ficam abertos (medido: 4 pedidos abertos após 15 s), e a rede nunca fica ociosa. No lab alterna; aqui a "ponta verde" falhou e a "vermelha" passou. | **Instável** (espera inadequada) | `waitUntil: "load"`: espera os scripts da própria tela, e os cliques esperam o botão. |

**Resultado no laboratório local, os seis juntos com 2 workers:** 27 passed.

## Devolução do lab-critico (12/11): t231 "cartão buscas" = NaN

- **Sintoma no CI** (run 43175079238): `Error: cartão buscas — Expected: 3, Received: NaN`, também no retry. Localmente o t231 passava sozinho e também no portão inteiro.
- **Causa** (pelo `servidor.log` do artefato): `[admin] visão geral: canceling statement due to statement timeout`, 14 vezes.
  - A série diária de `admin_visao_geral` fazia 6 subconsultas correlacionadas **por dia** do período, um custo O(dias × linhas).
  - O t231 sorteia um período de 40 a 340 dias. No runner do CI a função passou do `statement_timeout` de 8 s, `getVisaoGeral` voltou "erro" e a tela mostrou "—" em todos os indicadores (`dados?.atual ?? {}`).
- **Correção**: a migração **0342** (`aplicar-0342.sql` + rollback) agrega cada tabela uma vez por dia de Brasília e junta com `generate_series`. O resto da função é idêntico ao da 0266. O teste não mudou.
- **Prova de equivalência** (banco do lab, transação descartada): a função velha e a nova devolvem o **mesmo JSON**.
  - Casos: 18 combinações de período (1 a 701 dias) × cidade, também com 20 mil eventos e as datas de perfis, leads, contratos e pedidos espalhadas por 700 dias.
  - Tempo: a nova fica entre 18 e 83 ms; a velha ia até 1.356 ms.
- **Guarda**: `tests/migracoes/admin-visao-geral-serie-0342.test.ts` exige que a definição vigente não tenha subconsulta por dia, além de aplicar = migração e rollback = 0266.
