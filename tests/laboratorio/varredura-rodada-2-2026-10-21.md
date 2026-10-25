# Varredura t249 — rodada 2 (21/10)

Execução manual na main: run [39689788111](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/39689788111), commit `d55e100`, 22h58–00h03 UTC.
Fontes: `lab_execucoes` (registro da run) e o log do job. O artefato (`varredura-relatorio.md`, prints) não abriu daqui: o proxy da sessão bloqueia o servidor de artefatos.

## Resultado da t249

| Bloco | Resultado |
|---|---|
| Varrer a 1280 px | falhou: critério b em Buscar |
| Varrer a 390 px | falhou: critério b em Início |
| D-V1, D-V2, D-V4, D-V6 | passaram (já eram teste normal neste commit) |
| D-V3, D-V5 | falha esperada (`test.fail`): seguem abertos com a Pista A |
| Pulados | 0 de 8 — a massa rodou e todas as telas foram varridas |

## Critério b pela régua do Muse

Este commit ainda não tem o #995: a rodada mediu b pela régua antiga (qualquer controle sob algo fixo).

| Tela | Tamanho | Achado | Pela régua |
|---|---|---|---|
| Buscar | 1280 | no fim da página, campos (`INPUT`) sob a barra fixa do topo ("VivaNomads Qualquer cidade Qualquer período…") | não é defeito: a barra é do topo e rolar para cima revela os campos |
| Início | 390 | no fim da página, "Ver todos os imóveis" sob a barra fixa do topo ("VivaNomads Buscar imóveis Publicar pedido…") | não é defeito: mesmo caso |

Os dois somem com o #995, que rola o controle até o meio da tela antes de acusar. O texto do erro em `lab_execucoes` mostra só o primeiro achado de cada tamanho; se houver outros na mesma combinação, aparecem no artefato.

## Defeitos da rodada 2, um por linha

| Código | Página | Tamanho | Evidência | Novo ou conhecido | Situação |
|---|---|---|---|---|---|
| D-V3 | Editar anúncio ativo (`/dashboard/imoveis/:id/editar`) | 390 | "Enviar documento" não responde e não diz qual campo falta (`test.fail` falhou como esperado) | Conhecido | Aberto, Pista A |
| D-V5 | Editar anúncio ativo (`/dashboard/imoveis/:id/editar`) | 1280 | "Anúncio publicado" e "Falta para publicar" na mesma tela (`test.fail` falhou como esperado) | Conhecido | Aberto, Pista A |
| D-V1 | Anúncio com 17 fotos (`/imoveis/:id`) | 390 e 1280 | Imagens acima da dobra carregaram sem rolar | Conhecido | Passou: corrigido |
| D-V2 | Cadastro com 0 fotos (`/dashboard/imoveis/novo`) | 390 | A barra "Fotos: 0 de 8" não ficou fixa sobre o conteúdo | Conhecido | Passou: corrigido |
| D-V4 | Meus imóveis (`/dashboard/imoveis`) | 1280 | Todos os cartões com miniatura carregada | Conhecido | Passou: corrigido |
| D-V6 | Minhas locações (`/dashboard/locacoes`) | 390 e 1280 | Capa carregou acima da dobra | Conhecido | Passou: corrigido |
| — | Buscar (`/buscar`) | 1280 | Critério b: campos sob a barra fixa do topo, no fim da página | Achado novo | Não é defeito pela régua do Muse (a rolagem revela) |
| — | Início (`/`) | 390 | Critério b: "Ver todos os imóveis" sob a barra fixa do topo, no fim da página | Achado novo | Não é defeito pela régua do Muse (a rolagem revela) |

Defeito novo de produto na rodada 2: nenhum entre os achados registrados. Limite: `lab_execucoes` guarda só o primeiro achado de cada tamanho e o artefato não abre daqui, então outros achados na mesma rodada, se houver, não aparecem nesta tabela.

## Conta para as 3 rodadas estáveis?

Vale como rodada de varredura: rodou de verdade, sem pulos. Verde, não: as 2 falhas são da régua antiga. A rodada 3 já roda com #995 e #996 (régua do b e atribuição do d) e é a primeira que pode sair verde.

## A suíte em volta: execução "metade" de novo

823 aprovados, 88 falhas, 678 pulados: bateu no teto de 65 min. O #990 (sessão em 2 h) não resolveu; a causa era outra.

**Causa:** o cookie `vn_admin_ativo` (última navegação da admin em /admin) ia gravado na sessão do global-setup com a hora do setup. Toda aba nova da admin começava com essa hora. Passados 30 min do setup, o proxy via a admin "ociosa", encerrava a sessão (a mesma em todas as abas) e o resto das specs de admin caía no login ("Bem-vindo de volta", `/auth?redirect=/admin`), cada uma esperando até o tempo dela acabar.

**Evidência:** em 19 execuções da main desde 20/10, t227, t229, t231, t233, t236, t239, t242 e o cenário 2 do t241 falham em 11 de 11 "metades" e em 0 de 8 completas. Na rodada 2, as specs de admin até t21 passam (t108, t14, t15, t204, t21) e da t220 em diante falham, inclusive t212–t214 e t24, que usam a sessão da admin. Nas completas a suíte chega à faixa t22x antes dos 30 min.

**Correção (só laboratório):** o global-setup grava a sessão sem esse cookie (`tests/e2e/fixtures/sessao-gravada.ts`); cada aba começa como sessão nova e o proxy grava a hora dela. A regra de produto (admin sai depois de 30 min parada) não muda.

## t241 — veredito

| Cenário | Causa | Classificação | Situação |
|---|---|---|---|
| 3a (titular) | "Fale com a Viva" por cima de "Salvar qualificação" a 1280 px, sem folga no fim do painel: 338 cliques interceptados (trace da run 39666274916) | Produto | Corrigido na main pelo `f72f524` (painel com 112 px de folga no fim). Ainda não rodou depois disso: nas execuções seguintes o cenário 2 caiu antes |
| 2 (marcar conta de teste) | Sessão da admin encerrada pelo proxy (acima) | Laboratório | Corrigido nesta branch |

A hipótese da triagem ("a fila esconde contas de teste") está descartada: a fila mostra o cartão do dono normalmente. t233, t32 e t36 têm a mesma causa do cenário 2. A t237 falha também em execuções completas e fica como achado separado.
