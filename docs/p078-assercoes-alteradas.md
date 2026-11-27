# Prompt 078 — asserções alteradas (decisão "078, Daniel", 16/11/2026)

Decisão: lançar sem o Plano Gestor público de 4%. A escada pública termina em "16 ou mais = 6%"; no lugar do plano, a
linha "Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva."

Toda asserção listada aqui foi trocada pelo valor novo da decisão, com a mesma força: o que era cobrado como presente
(Plano Gestor, 4%, "16–19") passa a ser cobrado como ausente, e a escada nova e a linha de carteiras como presentes.
Nenhum teste foi pulado, apagado ou marcado como falha esperada. Cada linha alterada leva no código o comentário
`// 078 (Daniel, 16/11/2026): …`.

Duas correções feitas na revisão, depois destas tabelas:

- `src/lib/financeiro/textos-socios.test.ts`: a guarda original (`/modelodenegocio` não lê `@/config/planos`) voltou a
  valer sem mudança. A página lê a linha de carteiras por `@/lib/planos/gestor`, a mesma porta que o texto do Gestor usava.
- `src/lib/planos/gestor-minimo-textos.test.ts`: acompanha essa porta (cobra o import de `@/lib/planos/gestor` e a
  ausência de `@/config/planos` e de `GESTOR_TEXTO` na página).

## Testes de unidade (`node --test`)


"Gestor" = Plano Gestor de 4%. "Carteiras" = `TEXTO_CARTEIRAS` ("Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.").

| Arquivo | Teste | Antes → depois |
|---|---|---|
| `src/lib/atendimento/parceiros.test.ts` | E564/078: a faixa menor citada… | `match /menor a taxa (até 4%)/` → `(até 6%)`; `doesNotMatch /até 6%/` → `doesNotMatch /até 4%/` (o proibido inverteu) |
| `src/lib/atendimento/resumo.test.ts` | preço que a Viva informa é a regra única… | frase com "(até 4%)" → "(até 6%)" |
| `src/lib/cobranca/achado83-85.test.ts` | achado 83 | guarda `if (e1 \|\| e2 \|\| e3 \|\| e5) throw` → `if (e1 \|\| e2 \|\| e3) throw` + `taxaDoDonoAgora` não cita `account_type` nem `e4`/`e5` |
| `src/lib/cobranca/bolso.test.ts` | 20 / 80 imóvel(is) | `0.04 / "4%"` → `0.06 / "6%"` |
| idem | E564/078: a faixa 31+ negociável saiu… | `[0.04, 720]` → `[0.06, 1080]` (31 e 80 imóveis) |
| `src/lib/cobranca/e302-ver-plano-gestor.test.ts` | E302/078 | TINHA o link `#plano-gestor` / `precos-ver-plano-gestor` / "Ver o Plano Gestor" → NÃO tem nenhum dos três; `id="plano-gestor"` → NÃO tem + seção `id="carteiras"` / `carteiras-secao` / "Carteiras e administradoras" / `carteiras-texto` = `{TEXTO_CARTEIRAS}` |
| `src/lib/cobranca/e628-faixa-do-dono.test.ts` | cada faixa do dono tem nome | nomes `[…, "16–19 imóveis", "20+ imóveis · Plano Gestor"]` → `[…, "16+ imóveis"]`; "só a do Gestor traz detalhe" → toda faixa devolve só `{ nome }` e nenhuma tem `gestor` |
| idem | com 20 imóveis ativos… | taxa `0.04` → `0.06`; nome → `"16+ imóveis"`; `d.gestor = {carteira, detalhe}` → `d` é `{ nome: "16+ imóveis" }`; última linha de `TAXA_FAIXAS` = `{ taxa: 0.06, carteira: "16 ou mais imóveis" }` (sem detalhe); 19 = 16 = 20 (mesma faixa), 15 = "6–15 imóveis" |
| idem | a tela do dono usa a função… | TINHA `faixa-gestor-detalhe` → NÃO tem; destaque `faixa.gestor ? … ROTULO_FAIXA_GESTOR : taxaTexto` → `valor: taxaTexto` e sem `ROTULO_FAIXA_GESTOR`/`faixa.gestor`; última faixa começa em 16 |
| `src/lib/cobranca/plano-gestor-lead.test.ts` | /precos mostra o botão… | `/Falar sobre o Plano Gestor/` → botão `plano-gestor-botao` = "Falar com a Viva sobre carteiras" + texto de tela sem "Plano Gestor" |
| `src/lib/cobranca/regra.test.ts` | 4.320 (1 mês) por faixa | `[20, 40] → [172.8, 172.8]` → `[259.2, 259.2]` |
| idem | E564/078: 20+ imóveis… | `valor(40)` 172.8 → 259.2; `faixa(20).gestor === true` → faixa(20) = `{16, null, 0.06}`; `faixa(19).gestor === undefined` → faixa(19) === faixa(20), nenhuma faixa com `gestor`; administradora com 1 imóvel `0.04` → `0.12` (origem "faixa"), com 3 imóveis `0.1` |
| idem | limites das faixas | `[…, 0.04, 0.04]` → `[…, 0.06, 0.06]`; `length 5` → `4` |
| idem | texto oficial | `TEXTO_REGRA_UNICA` "(até 4%)" → "(até 6%)" |
| idem | E564/078: tabela pública | `["12%","10%","8%","6%","4%"]` → sem o "4%"; rótulo da 5ª faixa "20+ imóveis · Plano Gestor" → não há 5ª faixa, a 4ª é "16+ imóveis"; rótulos curtos `["1–2","3–5","6–15","16+"]` |
| idem | F6/078: chat da Viva | TINHA "O Plano Gestor tem taxa de 4% por contrato… ${PORTA_GESTOR_TEXTO}." → NÃO cita Plano Gestor / PORTA_GESTOR_TEXTO / 4%; fonte e `fontes()` trazem a escada curta + carteiras + "Para esses casos não existe taxa publicada…" |
| `src/lib/e563-precos-suspensa.test.ts` | as outras portas… | `precosVisivel ? [{ href: "/precos#plano-gestor"` → `href: precosVisivel ? "/precos#carteiras" : "/para-proprietarios#taxa"` + sem `precos#plano-gestor` |
| `src/lib/e564-textos-gestor.test.ts` | 078: a linha única das carteiras… | `GESTOR_PRECO.taxa === 0.04` → constante não existe, `CARTEIRAS_MINIMO_IMOVEIS === 20`; `GESTOR_TEXTO === "4% para carteiras…"` → não existe, `TEXTO_CARTEIRAS` literal, sem `%`/cadastro assistido/contato direto |
| idem | 078: nenhum diferencial de Gestor… | `GESTOR_DIFERENCIAIS` = 4 itens → não existe; `g.beneficios` = os 4 → `[]`, `custoLabel` "Condições combinadas com a Viva", `cta` "Falar com a Viva", `comissao` 0.04 (histórico); fonte sem os 4 textos |
| idem | 5 telas (um caso por arquivo) | `/GESTOR_TEXTO\|FRASE_ESCADA_TAXAS/` → padrão exato de cada tela com carteiras + sem GESTOR_TEXTO/GESTOR_DIFERENCIAIS/GESTOR_PRECO/"Plano Gestor"/4% no texto de tela |
| idem | /precos: a seção das carteiras | seção `id="plano-gestor"` com `plano-gestor-texto` e `GESTOR_DIFERENCIAIS.map` → seção `id="carteiras"` com título + `carteiras-texto`, sem lista, taxa nem plano; âncora antiga inexistente |
| idem | /anunciar | `FAIXAS_PUBLICAS = FAIXAS_COMISSAO_PADRAO.filter(!f.gestor)` → `import { TAXA_MAIOR_TEXTO }` + `const TAXA_MAIOR = TAXA_MAIOR_TEXTO;` e sem `FAIXAS_PUBLICAS`/`f.gestor` |
| idem | apresentação estática | `16–19 imóveis — 6%` → `16 ou mais imóveis — 6%` (e sem "16–19"); `Plano Gestor — 4%` → linha das carteiras "Fale com a Viva" + sem "Plano Gestor"/`<b>4%</b>` |
| `src/lib/e578-home-gestor.test.ts` | 078: a home não cita mais o Plano Gestor | frase "(até 6%; Plano Gestor: {GESTOR_PCT_HOME}% a partir de …)" → "(até {TAXA_MENOR_TEXTO}). Sem mensalidade. {TEXTO_CARTEIRAS}" + sem "Plano Gestor"; `const GESTOR_PCT_HOME = …` → imports de `TAXA_MAIOR_TEXTO, TAXA_MENOR_TEXTO` e `TEXTO_CARTEIRAS`, valores "6%" e a linha literal |
| idem | o resto do parágrafo não muda | "A Viva cobra 12% sobre…" → "A Viva cobra {TAXA_MAIOR_TEXTO} sobre…" (= "12%"); `doesNotMatch /menor a taxa (até 6%). Sem/` → `doesNotMatch` percentual digitado à mão no parágrafo (a frase sem o Gestor agora é a certa) |
| `src/lib/e667-modelo-sem-31.test.ts` | E667/078 | `FAIXA_GESTOR.minImoveis === 20` → última faixa = `{16, null, 0.06}`, uma só sem teto; legenda "Plano Gestor: {GESTOR_TEXTO}." → "{TEXTO_CARTEIRAS}" + página sem "Plano Gestor"/`GESTOR_TEXTO`/`f.gestor` |
| `src/lib/e805-escada-taxas.test.ts` | a escada sai da regra | "… · 16–19 imóveis: 6%" → "… · 16 ou mais imóveis: 6%" + nº de degraus = nº de faixas |
| idem | a frase única… | pedaços "16–19 imóveis: 6%" e "Plano Gestor: ${GESTOR_TEXTO}" → "16 ou mais imóveis: 6%" e `TEXTO_CARTEIRAS`; frase inteira literal; `GESTOR_TEXTO` começa por 4% → frase sem "Plano Gestor"/4%, carteiras sem `%` |
| `src/lib/financeiro/custos-v3.test.ts` | v3: contrato de referência | taxas `[…, 0.04]` → 4 taxas; receitas `[…, 360]` → 4 receitas |
| idem | E623/078 | última linha: taxa `0.04` → `0.06`; carteira "Gestor: 20+ imóveis ou administradora" → "16 ou mais imóveis" (4 carteiras literais); `detalhe` "cadastro assistido e contato direto" → nenhuma linha tem outra chave além de `taxa`/`carteira`; tela TINHA `faixa-gestor-detalhe` → NÃO tem, tem `faixa-carteiras` = `{TEXTO_CARTEIRAS}` |
| `src/lib/financeiro/projecao.test.ts` | números da regra única… | `FAIXAS[4].taxa` → 172,80 → não há 5ª faixa (`length 4`); carteira de 20 e última faixa = 259,20 |
| idem | taxa média do modelo… | `taxaMediaPonderada([NaN,-1,0,0,3]) === 0.04` → `[NaN,-1,0,3] === 0.06` e a 5ª posição é ignorada (`0.12`) |
| `src/lib/financeiro/textos-socios.test.ts` | /modelodenegocio… | `!includes("@/config/planos")` → **um único** import de `@/config/planos`, só de `TEXTO_CARTEIRAS`, e sem `PLANOS`/`PLANS`/`PLANOS_BASE`/`planoPorId`/`PlanoId`/`@/lib/planos/gestor` (ver Achado 1); `includes("Plano Gestor")` → NÃO inclui + `{TEXTO_CARTEIRAS}` 3 vezes |
| `src/lib/parceiros/bloco-parceiro-e301.test.ts` | E302/078 | link `{ href: "/precos#plano-gestor", rotulo: "Ver o Plano Gestor" }` → `/precos#carteiras` ou `/para-proprietarios#taxa` com `ROTULO_VER_TAXAS = "Ver as taxas"`; `id="plano-gestor"` → `id="carteiras"`; `<h3>Plano Gestor</h3>` → `<h3>Carteiras e administradoras</h3>` |
| idem | E303/E564/078 | `GESTOR_PRECO.minimoImoveis === 20` → `CARTEIRAS_MINIMO_IMOVEIS === 20`; faixa `gestor` começa em 20 → nenhuma faixa `gestor`, nenhum degrau em 20, sem teto = `{16, null, 0.06}`; seção com `GESTOR_TEXTO` + diferenciais → seção `carteiras` sem lista; /parceiros "Plano Gestor: ${GESTOR_TEXTO}" → "Taxa menor por volume. ${TEXTO_CARTEIRAS}" e sem "Plano Gestor" |
| `src/lib/parceiros/e896-cartao-gestores.test.ts` | preços suspensos | rótulo `/Plano Gestor/` → `"Ver as taxas"` (sem "Gestor") |
| idem | preços visíveis | `[{ "/precos#plano-gestor", "Ver o Plano Gestor" }]` → `[{ "/precos#carteiras", "Ver as taxas" }]` + continua porta de preços + âncora existe na página |
| `src/lib/planos/e321-porta-gestor.test.ts` | a porta das carteiras é uma só | `PORTA_GESTOR_TEXTO` literal → não existe; `TEXTO_CARTEIRAS` pela constante, sem `%`/"plano"; `GESTOR_MIN_IMOVEIS_VALIDADOS === 20` → não existe, `CARTEIRAS_MINIMO_IMOVEIS === 20`; `gestorElegivel` (adm. = sim; 20 = sim; 19 = não) → não existe; administradora paga a faixa (0 → 12%, 3 → 10% = conta comum), 19 e 20 = 6% |
| idem | telas e atendimento | telas `/GESTOR_TEXTO/` → padrão de carteiras de cada tela + sem `GESTOR_TEXTO`; atendimento `/PORTA_GESTOR_TEXTO/` → `${escadaTaxasCurta()}. ${TEXTO_CARTEIRAS}` + sem `PORTA_GESTOR_TEXTO`/"Plano Gestor"; "Gestor a partir de N sem administradora" → "`{CARTEIRAS_MINIMO_IMOVEIS}` sempre seguido de 'imóveis ou administradora de imóveis'" |
| `src/lib/planos/e905-gestor-administradora.test.ts` | E905/078 (1) | `GESTOR_TEXTO` literal / `PORTA_GESTOR_TEXTO` termina em "ou conta de administradora" → constantes não existem; `TEXTO_CARTEIRAS` literal, termina em "20 imóveis ou administradora de imóveis: fale com a Viva."; a Ajuda usa a mesma linha |
| idem | E905/078 (2) | frase com "Plano Gestor: 4% para carteiras de 20 ou mais imóveis ou conta de administradora," → termina em "16 ou mais imóveis: 6%. Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva." e sem "Plano Gestor"/4% |
| `src/lib/planos/gestor-minimo-textos.test.ts` | `N` | `GESTOR_PRECO.minimoImoveis` → `CARTEIRAS_MINIMO_IMOVEIS` |
| idem | VARREDURA public/ | apresentação TINHA "Plano Gestor — 4%" → tem a linha montada a partir de `TEXTO_CARTEIRAS` ("… — Fale com a Viva") e NÃO tem "Plano Gestor"/`<b>4%</b>` |
| idem | os 4 pontos do E236… | 6 arquivos: `/GESTOR_PRECO.minimoImoveis\|PORTA_GESTOR_TEXTO\|GESTOR_TEXTO/` → `/CARTEIRAS_MINIMO_IMOVEIS\|TEXTO_CARTEIRAS/` + sem as constantes antigas; `planos.ts`: declaração de `PORTA_GESTOR_TEXTO`/`GESTOR_TEXTO` → `CARTEIRAS_MINIMO_IMOVEIS = 20` + `TEXTO_CARTEIRAS` lendo a constante, e nenhuma constante `GESTOR_*` declarada; /parceiros; `title="Plano Gestor"` → `title="Fale com a Viva sobre carteiras"`; assunto "Lead — Plano Gestor (N+ imóveis)" → "Contato — carteira (N+ imóveis ou administradora)"; modelo-negocio lê `GESTOR_TEXTO` de `@/lib/planos/gestor` → lê `TEXTO_CARTEIRAS` de `@/config/planos`; `gestor.ts` sem `GESTOR_MIN_IMOVEIS_VALIDADOS` nem número próprio |
| idem | os textos prontos… | Ajuda TINHA "O Plano Gestor tem taxa de 4%… ${PORTA_GESTOR_TEXTO}" → nenhuma resposta cita o plano; "custo-anunciar" traz escada curta + carteiras, sem 4%; `PORTA_GESTOR_TEXTO.startsWith("N imóveis ou mais")` → `TEXTO_CARTEIRAS.startsWith("Carteira a partir de N imóveis ou administradora de imóveis")`; `EMPRESAS_E_GESTORES` idem |
| idem | E564/078: a faixa sem teto… | `minImoveis` 20 → 16; taxa 0.04 → 0.06; `gestor === true` → nenhuma faixa `gestor`; penúltima termina em 19 → em 15; carteira de N e N−1 caem na última faixa |
| idem | E564/078: os rótulos da tabela | `[…, "16–19 imóveis", "20+ imóveis · Plano Gestor"]` → `[…, "16+ imóveis"]`; "sem Gestor/negoci" passou a valer para TODAS as faixas (antes pulava a última) |
| `src/lib/planos/gestor.test.ts` | 4 casos reescritos (regra 3) | `gestorElegivel(adm.)` → administradora paga a faixa (0/1 → 12%, 3 → 10%, = conta comum em 6 carteiras); `GESTOR_MIN… === 20` e elegível com 20/25, não com 19/5/0 → `CARTEIRAS_MINIMO_IMOVEIS === 20`, 20/25/19 = 6% (mesma faixa), 5 = 10%, 0 = 12%; "conta comum não ativa Gestor" → 3 imóveis = 10%, 4% só com taxa fixada pelo admin válida (sem motivo ou vencida = 10%); `faltamParaGestor` → `proximaFaixa` (0 → faltam 2; 3 → 3; 15 → 1; 16/20/30 → null) |
| `src/lib/planos/plano-gestor-e224.test.ts` | Conta › Plano | `textoElegibilidadeGestor` ("…Você tem N; faltam M." / "taxa de 4% nos próximos contratos") → `textoTaxaNaConta`: 0 → "…12%." ; 1 → "(1 imóvel ativo)"; 3 → 10%; 19 e 20 → 6%; taxa do admin → "4%, combinada com a Viva."; nenhuma linha com "Plano Gestor"/4%/"faltam" |
| idem | a tela do proprietário não promete checkout | `getGestorElegibilidade()` / `textoElegibilidadeGestor(e)` → `getTaxaDaConta()` / `t ? textoTaxaNaConta(t) : FRASE_ESCADA_TAXAS`, com `data-taxa`/`data-origem` e sem `data-elegivel`; `faltam: GESTOR_MIN_IMOVEIS_VALIDADOS` → sem sessão a ação devolve `null`, lê `taxaDoDonoAgora`, nenhuma taxa escrita à mão |
| `src/lib/taxa-matriz.test.ts` | 19. faixas | `[20, 0.04], [80, 0.04]` → `0.06`; `length 4`; `faixa(20).gestor === true` → `{16, null, 0.06}` = faixa(19); texto de 31 imóveis "4%" → "6%" |
| `src/lib/textos-publicos.test.ts` | #71 | "Plano Gestor: {GESTOR_TEXTO}. Conte sobre a sua carteira…" → "Para carteira a partir de {CARTEIRAS_MINIMO_IMOVEIS} imóveis ou administradora de imóveis. Conte sobre a sua carteira…" + sem "Plano Gestor"/`GESTOR_TEXTO`/percentual no texto de tela |
| `src/lib/vocab-a.test.ts` | (c) /para-proprietarios | `import { FAIXAS_COMISSAO_PADRAO, pctTexto }` → `import { TAXA_MAIOR_TEXTO }` + `const TAXA_MAIOR = TAXA_MAIOR_TEXTO;`; "públicas = faixas sem a do Gestor" → todas as faixas são públicas, nenhuma `gestor`; constantes = `["12%", "6%"]` |
| `tests/atendimento/parceiros-cenarios.test.ts` | "Como virar parceiro da Viva?" | `/Plano Gestor/` → linha das carteiras + escada por extenso, e a resposta NÃO diz "Plano Gestor"/4% |
| idem | o prompt da Viva traz… | `/Plano Gestor/` e `/12\/10\/8\/6%/` → carteiras e "a taxa de serviço cai com o volume (1–2 = 12%, … 16 ou mais = 6%)"; `doesNotMatch /até 6%/` → `match "(até 6%)"` e `doesNotMatch "Plano Gestor" / "até 4%" / 4%` |
| `tests/laboratorio/specs-desatualizadas-lote2.test.ts` | t656 | texto de `textoElegibilidadeGestor(0 de 20)` → texto de `textoTaxaNaConta({ taxa: 0.12, origem: "faixa", imoveisAtivos: 0 })`, contido na spec; a spec não espera texto com "Plano Gestor" |
| `tests/migracoes/faixa-gestor-0293.test.ts` | servidor (078) — só este caso | LIA `profiles.account_type` → NÃO lê; passava `administradora:` → não passa; marcava `{ gestor: true }` → não marca (linha = `minImoveis`/`maxImoveis`/`taxa`); `comissao: 0.04, // E564` → `comissao: 0.04` sob o comentário "HISTÓRICO (prompt 078…)" com `beneficios: []`; `TAXAS_HISTORICAS` inclui 0,04; `taxaDoContrato(0.04, null)` e `(null, "gestor")` = 0,04. Os dois casos dos arquivos SQL da 0293 não mudaram |


## Testes de ponta a ponta (Playwright)


Todas levam `// 078 (Daniel, 16/11/2026): …` e o cabeçalho de cada arquivo ganhou a linha "Asserções alteradas pelo prompt 078 …".

| Arquivo | Teste | Antes → depois |
|---|---|---|
| `t866-e578-home-gestor.spec.ts` | `T866 — home (Npx)` (2 casos; título era "…cita o Plano Gestor") | bloco contém `…(até 6%; Plano Gestor: 4% a partir de 20 imóveis ou para administradoras). Sem mensalidade.` → contém `Quanto mais imóveis, menor a taxa (até 6%). Sem mensalidade. ${TEXTO_CARTEIRAS}` |
| idem | idem | `not.toContainText("(até 6%).")` → `not.toContainText("(até 6%;")`, `not /Plano Gestor/i`, `not /(?<![\d.,])4\s?%/` (o que aparecia passa a ser cobrado como ausente) |
| `t766-e302-ver-plano-gestor-precos.spec.ts` | `T766 — E302/078 … (N px)` (2 casos) | botão `plano-gestor-botao` = "Falar sobre o Plano Gestor" → "Falar com a Viva sobre carteiras" |
| idem | idem | `precos-ver-plano-gestor` com texto "Ver o Plano Gestor" e `href="#plano-gestor"` → `precos-ver-plano-gestor`, link com "Plano Gestor", `a[href$="#plano-gestor"]`, `#plano-gestor` e `plano-gestor-secao`: todos `toHaveCount(0)` |
| idem | idem | clique em "Ver o Plano Gestor" (na própria /precos) → URL `#plano-gestor`, `plano-gestor-secao` na tela com "Plano Gestor" → clique em "Ver as taxas" do cartão de /parceiros (`href="/precos#carteiras"`) → URL `/precos#carteiras`, `carteiras-secao` (id `carteiras`) na tela, h3 "Carteiras e administradoras", `carteiras-texto` = `TEXTO_CARTEIRAS`, sem "Plano Gestor" |
| `t861-e564-gestor-4.spec.ts` | `/para-proprietarios` e `/parceiros` (4 casos; título era `"Plano Gestor: {GESTOR_TEXTO}", sem texto antigo nem fase 2`) | `toContain("Plano Gestor: " + GESTOR_TEXTO)` → `/para-proprietarios`: `toContain("Quanto mais imóveis ativos, menor a taxa: " + escadaTaxasTexto() + ". " + TEXTO_CARTEIRAS)`; `/parceiros`: `toContain("Taxa menor por volume. " + TEXTO_CARTEIRAS)`; nas duas, `achadosProibidos(<main>)` filtrado por `plano-gestor-publico`/`taxa-de-4-publica` = `[]` |
| idem | idem | lista `ANTIGOS` ganhou `/Plano Gestor/i`, `/cadastro assistido da carteira/i`, `/contato direto na Viva/i` (o texto do Gestor virou "não pode aparecer") |
| idem | `/precos: a seção das carteiras…` (2 casos; título era "a seção do Gestor tem o texto e os 4 diferenciais") | `plano-gestor-texto` = `GESTOR_TEXTO + "."` e `plano-gestor-diferenciais li` = `GESTOR_DIFERENCIAIS` → `carteiras-secao` h3 "Carteiras e administradoras", `carteiras-texto` = `TEXTO_CARTEIRAS`, `carteiras-secao li` = 0, `plano-gestor-secao|texto|diferenciais` e `precos-ver-plano-gestor` = 0; tabela/cartões com 4 faixas, a última `rotuloFaixaTaxa(ultima)` ("16+") a "6%"; `<main>` sem Plano Gestor nem 4% |
| idem | describe | título "T861 — E564 Gestor 4%" → "T861 — E564 revisto pelo 078: sem Gestor 4%"; etiquetas `["@E564", "@ao-vivo-seguro"]` → `["@E564", "@078", "@ao-vivo-seguro"]` |
| `t659-e236-gestor-20.spec.ts` | `N px — /parceiros, /modelodenegocio, /precos e /termos` (2 casos) | /parceiros: `toContain("Plano Gestor: " + GESTOR_TEXTO)` → `toContain("Taxa menor por volume. " + TEXTO_CARTEIRAS)` + `not /Plano Gestor/i` + `not /Carteira a partir de (?!20\b)\d+ imóveis/` |
| idem | idem | /modelodenegocio: `toContain("Plano Gestor: " + GESTOR_TEXTO)` → `toContain(TEXTO_CARTEIRAS)` + `not /Plano Gestor/i` + mesma guarda do mínimo 20 |
| idem | idem | /precos: (novo) `<main>` contém `TEXTO_CARTEIRAS` e não contém "Plano Gestor"; janela `getByRole("dialog").filter({ hasText: "Plano Gestor" })` contendo `"Plano Gestor: " + GESTOR_TEXTO` → `getByRole("dialog", { name: "Fale com a Viva sobre carteiras" })` contendo `"Para carteira a partir de " + CARTEIRAS_MINIMO_IMOVEIS + " imóveis ou administradora de imóveis."`, sem "Plano Gestor" (o `not /\b31\b/` ficou) |
| idem | `N px — /precos: a última faixa…` (2 casos; título era "…é a do Plano Gestor, a 4% (sem 31+)") | `faixas toContainText("4%")` → última linha contém "16+" ("16+ imóveis" a 390) e "6%"; tabela sem `/(?<![\d.,])4\s?%/`, sem `/20\+|Gestor/i` (o `rotuloFaixaTaxa(ultima)` e o "sem 31+/Negociado" ficaram) |
| `t656-e224-plano-gestor.spec.ts` | `1a. proprietário sem imóvel aprovado…` (título era "'Você tem 0; faltam 20.' e nenhum botão de assinar") | `toHaveText("Plano Gestor: taxa de 4% com 20 imóveis ativos (…). Você tem 0; faltam 20.")` → `toHaveText("Sua taxa de serviço hoje é de 12%. Quanto mais imóveis ativos, menor a taxa: 1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16 ou mais imóveis: 6%. Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.")` (literal de propósito, igual a `textoTaxaNaConta({ taxa: 0.12, origem: "faixa", imoveisAtivos: 0 })`) |
| idem | idem | `data-elegivel="0"` → `data-taxa="0.12"`, `data-origem="faixa"`, sem atributo `data-elegivel`; cartão sem "Plano Gestor" nem 4% (sem botão e sem link: ficou) |
| idem | `1b. conta de administradora…` (título era "já liberado (administradora): 'Liberado. Fale com a Viva para ativar.'") | `toHaveText("Liberado. Fale com a Viva para ativar.")` + `data-elegivel="1"` → a administradora vê a MESMA linha do 1a (12%), `data-taxa="0.12"`, `data-origem="faixa"`, sem "Plano Gestor", "Liberado" nem 4%; confere antes que o banco está em `account_type = 'gestor'` |
| idem | casos 2 e 3 | sem mudança (tipo da conta no admin e recusa de quem não é admin) |
| `t1191-e592-simulacao-premissas.spec.ts` | `Npx — modelo v3…` (2 casos) | `faixa-12/10/8/6/4` visíveis → `faixa-12/10/8/6` visíveis, `seletor-faixa` com 4 botões, `faixa-4` = 0 |
| idem | idem | `faixa-4 toContainText("Gestor: 20+ imóveis ou administradora")` → `faixa-6 toHaveText("6% (16 ou mais imóveis)")`; `seletor-faixa` sem Gestor, "20+" nem 4% |
| idem | idem | `faixa-gestor-detalhe toContainText("cadastro assistido e contato direto")` → `faixa-gestor-detalhe` = 0 e `faixa-carteiras toHaveText(TEXTO_CARTEIRAS)`; corpo sem "cadastro assistido e contato direto"/"Gestor: 20+"/"ou administradora (Gestor)" e com "6–15 imóveis 8% · 16+ imóveis 6%" |
| `t12-planos.spec.ts` | `a taxa muda conforme o número de imóveis ativos…` | caso `["20", /4%/]` (controle até 20) → casos `["15", /8%/]` e `["16", /6%/]`; `#imoveis-ativos` com `max="16"`; `taxa-faixa` = "6%"; `faixa-nome` = "Sua faixa: 16+ imóveis"; `faixa-gestor-detalhe` = 0; corpo sem "Plano Gestor" |
| `t1396-e667-modelo-sem-31-segue.spec.ts` | `N px` (2 casos) | `toContain("Plano Gestor: " + GESTOR_TEXTO)` → `toContain("Com o mesmo cenário, no limite inferior de cada faixa. " + TEXTO_CARTEIRAS)` + `not /Plano Gestor/i` + `ultima.minImoveis` = 16 |
| `t185-precos-3s.spec.ts` | `T185 — o contato das carteiras (antes Plano Gestor) abre numa janela à parte e fecha` | `getByRole("dialog", { name: /Plano Gestor/ })` → `getByRole("dialog", { name: "Fale com a Viva sobre carteiras", exact: true })`; nenhuma janela com "Plano Gestor" no nome nem no texto |
| `t215-simulador-bolso.spec.ts` | `muda a faixa pela quantidade de imóveis; 16 ou mais é 6%…` (2 casos; título era "20+ é o Plano Gestor a 4%…") | `["20", "4%"]`, `["31", "4%"]` → `["20", "6%"]`, `["31", "6%"]`; em cada quantidade o detalhe não mostra 4%; o simulador não cita "Plano Gestor" |
| `t37-simuladores-e-numeros.spec.ts` | `390 px: os cartões de faixa…` | `plano-gestor-form toContainText("Plano Gestor: " + GESTOR_TEXTO)` → `toContainText("Para carteira a partir de " + CARTEIRAS_MINIMO_IMOVEIS + " imóveis ou administradora de imóveis. Conte sobre a sua carteira e o time da Viva fala com você.")` + `not /Plano Gestor|\d\s?%/i` |
| idem | demais casos | só comentários ajustados (as asserções leem `FAIXAS_COMISSAO_PADRAO` e `PLANOS` e continuam valendo — ver "Não mexi de propósito") |
| `t438-vocab-a.spec.ts` | `2. /para-proprietarios: 'taxa de serviço' com os números da regra` (2 casos) | `toContain("… · 16–19 imóveis: 6%. Plano Gestor: " + GESTOR_TEXTO + ".")` → `toContain("1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16 ou mais imóveis: 6%. " + TEXTO_CARTEIRAS)` (literal, como antes) + `not /Plano Gestor\|16–19/i` + `achadosProibidos` (as duas regras do 078) = `[]` |

### Candidatos que não precisaram mudar (7)

| Arquivo | Por quê |
|---|---|
| `t13-seguranca-rls.spec.ts` | `{ account_type: "gestor" }` é a tentativa de o usuário trocar o próprio tipo (recusada): o tipo continua existindo. |
| `t195-matricula-caf.spec.ts` | `matricula-caso-gestor` é o caso "gestor/procurador" da matrícula, não o plano. |
| `t32-autorizacao-preconferencia.spec.ts` | "Administro este imóvel em nome do proprietário (gestor ou procurador)": texto do cadastro, sem relação com taxa. |
| `t359-precos-taxa-e51-e54.spec.ts` | Os 4% são do anfitrião no Airbnb (`compare-precos.ts`, histórico reconhecido em `HISTORICO_078`); 3 imóveis → 10% continua. |
| `t545-e187-rotas-categoria-parceiros.spec.ts` | `/parceiros/gestores` → `/parceiros#tipos` não mudou. |
| `t661-varredura-bloco62.spec.ts` | Usa `plano-gestor-botao` só como marca de tela (o `data-testid` continua); "Plano Gestor" aparece só no nome do bloco. |
| `t97-plangate-precos.spec.ts` | Já cobrava "Plano Gestor" como ausente em /dashboard/carteira. |

### Não mexi de propósito (passam como estão)

- `t37`, casos puros "comissão 12 / 8 / 4 / 4 % (Gestor = faixa de 4%, #2519)" e "comissão em reais…": leem `COMISSAO_POR_PLANO`/`PLANOS`, que o 078 manteve como histórico (`gestor: 0.04`). O título ainda fala do Gestor a 4% — é o plano histórico, não a oferta.
- `t1191`, `expect(corpo).toMatch(/Stays \(channel manager\): só na fase 2 do Gestor/)`: o produto ainda mostra essa frase (ver Achado 2).
- `t12`, caso "Regra 1" (`POST /api/assinatura` com `planId: "gestor"` → 404) e o comentário do cabeçalho sobre "Gestor por elegibilidade".


## Teste novo

- `src/lib/cobranca/p078-escada-sem-gestor.test.ts` (unidade, 11 casos).
- `tests/e2e/specs/t1677-p078-escada-sem-gestor.spec.ts` (`@078 @ao-vivo-seguro`, 13 casos: páginas públicas e a Central de Ajuda a 390 e 1280 px).

## Acrescentadas no refresco sobre a main (ponta a ponta)

As duas vêm de specs que a main mudou ou ganhou depois da base deste ramo. Mesma regra das tabelas de cima: o que era
cobrado como presente (Plano Gestor, 4%, a faixa de 20+) passa a ser cobrado como ausente, com a mesma força.

| Arquivo | Teste | Antes → depois |
|---|---|---|
| `tests/e2e/specs/t656-e224-plano-gestor.spec.ts` | 1b. conta de administradora | na main (E564): título "1b. já liberado (administradora): 'Plano Gestor: taxa de 4% nos próximos contratos, sem assinatura.'", com esse texto e `data-elegivel="1"` → "1b. conta de administradora: a taxa continua a da faixa (12%)": a mesma linha do caso 1a, `data-taxa="0.12"`, `data-origem="faixa"`, e o cartão NÃO traz "Plano Gestor", "Liberado" nem 4% |
| `tests/e2e/specs/t2096-e628-faixa-do-dono-no-simulador.spec.ts` | 390 e 1280 px, o nome da faixa no simulador | "1, 19 e 20 imóveis": com 19, "16–19 imóveis"; com 20, "20+ imóveis · Plano Gestor", o detalhe "Gestor: 20+ imóveis ou administradora · cadastro assistido e contato direto." e 4% → "1, 15 e 16 imóveis": com 15, "6–15 imóveis" e 8%; com 16, "16+ imóveis" e 6%; o controle vai até 16 e a tela NÃO traz o detalhe do Gestor nem o nome do plano |

## Ajuste da ORDEM-DUET-534 (Gerente, 22/11/2026)

Decisão citada: "Vale a dos Termos do #4139: 16 a 19 imóveis: 6%; 20 ou mais, condição negociada." A escada PUBLICADA
deixa de terminar em "16 ou mais imóveis: 6%" e passa a terminar em "16–19 imóveis: 6%". A partir de 20 imóveis vale só a
linha de carteiras ("Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva."), sem percentual.

O que NÃO mudou: a tabela de cálculo (a última faixa continua sem teto, 6%) e a migração 0344. O teto publicado sai de
`tetoPublicado` (`src/lib/cobranca/regra.ts`): a faixa sem teto que começa antes do mínimo das carteiras é publicada até
o mínimo menos um (19). O modelo interno dos sócios continua a mostrar a faixa do cálculo ("16 ou mais"), por
`faixaDoCalculoPorExtenso`; as travas dele (`custos-v3.test.ts`, `t1191`, `t1396`, `e667-modelo-sem-31.test.ts`) não
mudaram.

Todas as asserções desta secção já tinham sido alteradas pelo 078 (tabelas de cima). Aqui só troca o rótulo da última
faixa; nenhuma asserção saiu.

### Rótulo da última faixa: "16 ou mais" / "16+" → "16–19"

| Arquivo | O que cobrava → o que cobra |
|---|---|
| `src/lib/cobranca/p078-escada-sem-gestor.test.ts` | escada "… · 16 ou mais imóveis: 6%" → "… · 16–19 imóveis: 6%"; curta "16 ou mais = 6%" → "16–19 = 6%"; rótulos "16+" / "16+ imóveis" → "16–19" / "16–19 imóveis" |
| `src/lib/cobranca/regra.test.ts` | rótulos da tabela pública `[…, "16+"]` → `[…, "16–19"]`; "16+ imóveis" → "16–19 imóveis"; frases com a escada |
| `src/lib/cobranca/e628-faixa-do-dono.test.ts` | nome da faixa do dono "16+ imóveis" → "16–19 imóveis" (inclusive com 20 imóveis ativos: o nome é o da última faixa publicada; a taxa calculada continua 6%). A comparação com a última linha da /simulacao dos sócios continua a cobrar "16 ou mais imóveis" |
| `src/lib/e805-escada-taxas.test.ts` | pedaço e frase inteira "16 ou mais imóveis: 6%" → "16–19 imóveis: 6%" |
| `src/lib/planos/gestor-minimo-textos.test.ts` | rótulos `[…, "16+ imóveis"]` → `[…, "16–19 imóveis"]` |
| `src/lib/planos/plano-gestor-e224.test.ts`, `src/lib/planos/e905-gestor-administradora.test.ts`, `src/config/planos.test.ts` | a frase da escada termina em "16–19 imóveis: 6%. Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva." |
| `src/lib/atendimento/parceiros.test.ts`, `tests/atendimento/parceiros-cenarios.test.ts` | resposta do atendimento "(1–2 = 12%, 3–5 = 10%, 6–15 = 8%, 16 ou mais = 6%)" → "(…, 16–19 = 6%)" |
| `src/lib/frases-proibidas.test.ts` | o texto da regra citado no teste ("a escada publicada termina em 16–19 = 6%") |
| `tests/e2e/specs/t1677-p078-escada-sem-gestor.spec.ts` | páginas públicas e Ajuda: "16 ou mais imóveis: 6%" → "16–19 imóveis: 6%"; a tabela de `/precos` termina em "16–19" |
| `tests/e2e/specs/t2096-e628-faixa-do-dono-no-simulador.spec.ts` | com 16 imóveis, `faixa-nome` "16+ imóveis" → "16–19 imóveis" (segunda alteração desta spec; a primeira está em "Acrescentadas no refresco") |
| `tests/e2e/specs/t12-planos.spec.ts` | `faixa-nome` "Sua faixa: 16+ imóveis" → "Sua faixa: 16–19 imóveis" |
| `tests/e2e/specs/t659-e236-gestor-20.spec.ts`, `tests/e2e/specs/t861-e564-gestor-4.spec.ts` | última linha da tabela de `/precos`: "16+" / "16+ imóveis" → "16–19" / "16–19 imóveis" (specs da página suspensa: pulam enquanto `/precos` estiver desligada) |
| `tests/e2e/specs/t438-vocab-a.spec.ts`, `tests/e2e/specs/t656-e224-plano-gestor.spec.ts` | a frase da escada em `/para-proprietarios` e em Conta › Plano termina em "16–19 imóveis: 6%" + a linha de carteiras |

### Negações invertidas

Antes do 078 a escada dizia "16–19"; o 078 passou a "16 ou mais" e proibiu "16–19". Com a ORDEM-534 a proibição
inverte: a tela diz "16–19" e não pode dizer "16 ou mais".

| Arquivo | Antes → depois |
|---|---|
| `src/lib/cobranca/p078-escada-sem-gestor.test.ts` (E995, respostas da Ajuda) | `doesNotMatch(/16–19|Plano Gestor|4%/)` → `doesNotMatch(/16 ou mais|Plano Gestor|4%/)` |
| `src/lib/e564-textos-gestor.test.ts` (apresentação estática) | `match(/16 ou mais imóveis…6%/)` + `doesNotMatch(/16–19 imóveis/)` → `match(/16–19 imóveis…6%/)` + `doesNotMatch(/16 ou mais imóveis/)` |
| `tests/e2e/specs/t1677-p078-escada-sem-gestor.spec.ts` (2 lugares) | `not.toContainText("16–19")` → `not.toContainText("16 ou mais")` |
| `tests/e2e/specs/t438-vocab-a.spec.ts` | `not.toMatch(/Plano Gestor|16–19/i)` → `not.toMatch(/Plano Gestor|16 ou mais/i)` |
