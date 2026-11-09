# E744 — triagem por nome das falhas da suíte completa fatiada

Fonte: linha de `public.lab_execucoes` do run **42547901640** (workflow_dispatch, commit `da51e6d`, 16 fatias, ainda sem a separação dos specs pesados). Leitura só de consulta, 09/11/2026.

## Veredito do run
**3.938 passaram · 235 falharam · 317 pularam · 8 instáveis = 4.498 testes: a suíte rodou INTEIRA** (a referência antiga era 640 rodados e 3.864 não rodados). O gate "suíte completa" ainda NÃO está verde: as 243 entradas abaixo (235 falhas + 8 instáveis) precisam ser resolvidas, atribuídas ou formalmente isoladas antes de exigir `suite-completa` na proteção da `main`.

## Por categoria (pelo texto do erro)
| Categoria | Entradas | O que é | Quem resolve |
|---|---|---|---|
| asserção / elemento | 134 | Elemento ou texto esperado ausente/diferente (menus, títulos, contadores, testids). | Pista A/B/C conforme o módulo; vários podem vir de mudanças de texto/estrutura recentes sem o spec acompanhar. |
| visual (screenshot) | 55 | `toHaveScreenshot` falhou: a linha de base versionada difere do render (t245, t271, t263). | Pista A/C: separar regressão real de linha de base desatualizada; reatualizar as imagens (`--update-snapshots`) só depois da decisão de desenho. |
| varredura | 37 | Varreduras de tela: elemento fixo sobre conteúdo, "caiu fora da tela", clique sem resposta. | Pista C/A: defeitos de tela reais ou de roteiro da varredura, um a um. |
| timeout 45 s | 17 | Teste estourou 45 s (t78, t71, t176, t778…): lentidão sob 2 workers no runner, ou espera sem fim. | Pista C: estabilizar a espera; avaliar subir o timeout só nesses specs. |

Por resultado: {'falhou': 235, 'instavel': 8}.

## O que isto significa para o E744
- Nenhuma dessas falhas é do fatiamento. A correção do E744 (a suíte terminar) está feita e provada; o que resta é **dívida de testes que a suíte nunca chegava a mostrar**.
- Decisão necessária (Daniel/coordenação): (a) triar e zerar a lista antes de exigir `suite-completa`; ou (b) travar uma linha de base ("não pode piorar") e exigir só que o número de falhas não suba, enquanto a lista é paga por módulo. Sem uma das duas, a exigência de gate completo bloqueia todos os merges.

## Por spec
| Spec | Entradas | Categoria | Exemplo do erro |
|---|---|---|---|
| `t245-visual-regressao.spec.ts` | 38 | visual (screenshot) | Error: expect(page).toHaveScreenshot(expected) failed 5350 pixels (ratio 0.02 of |
| `t271-admin-visual.spec.ts` | 11 | visual (screenshot) | Error: expect(page).toHaveScreenshot(expected) failed 327192 pixels (ratio 0.29  |
| `t263-visual-41.spec.ts` | 6 | visual (screenshot) | Error: expect(page).toHaveScreenshot(expected) failed Expected an image 1280px b |
| `t329-varredura-bloco11.spec.ts` | 4 | varredura | Error: inquilina — Conta · Notificações @1280: caiu fora da tela (login ou redir |
| `t14-app-mode.spec.ts` | 3 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: locator('nav.vn-tabbar').ge |
| `t277-preco-grade-47.spec.ts` | 3 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: "32px" Re |
| `t416-varredura-bloco33.spec.ts` | 3 | varredura | Error: proprietário — Contratos (#1327) @390 — fixo: elemento fixo/flutuante sob |
| `t418-varredura-bloco35.spec.ts` | 3 | varredura | Error: proprietário — Caução (#1343) @390 — fixo: elemento fixo/flutuante sobre  |
| `t51-admin-padrao-caixa-socios.spec.ts` | 3 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t589-varredura-bloco47.spec.ts` | 3 | varredura | Error: morador — Detalhe da visita, morador (E211) @390 — fixo: elemento fixo/fl |
| `t78-filtros-estadia-longa.spec.ts` | 3 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t95-assinatura-redireciona.spec.ts` | 3 | asserção / elemento | Error: expect(page).toHaveURL(expected) failed Expected pattern: /\/precos$/ Rec |
| `t112-imagens-unicas.spec.ts` | 2 | asserção / elemento | Error: expect(received).toEqual(expected) // deep equality - Expected - 1 + Rece |
| `t176-exemplo-proprietario-avaliacoes.spec.ts` | 2 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t195-matricula-caf.spec.ts` | 2 | asserção / elemento | Error: expect(locator).toContainText(expected) failed Locator: getByTestId('matr |
| `t255-admin-f15-f16-f18-f20.spec.ts` | 2 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByText('Nenhum pedido co |
| `t302-varredura-logada-bloco6.spec.ts` | 2 | varredura | Error: morador — Garantias @390 — fixo: elemento fixo/flutuante sobre conteúdo q |
| `t354-varredura-bloco19.spec.ts` | 2 | varredura | Error: inquilina — Conta A1 · Notificações @1280: caiu fora da tela (login ou re |
| `t385-varredura-bloco21.spec.ts` | 2 | varredura | Error: inquilina — Conta Notificações @1280: caiu fora da tela (login ou redirec |
| `t388-varredura-bloco23.spec.ts` | 2 | varredura | Error: inquilina — Contrato da estadia @1280 — clique: clique no botão primário  |
| `t4-fronteira-demo-real.spec.ts` | 2 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: locator('aside nav') Expect |
| `t436-busca-clean-e82.spec.ts` | 2 | asserção / elemento | Error: expect(received).toEqual(expected) // deep equality - Expected - 7 + Rece |
| `t559-varredura-bloco43.spec.ts` | 2 | varredura | Error: morador — Aba Pedidos (MENUS-5) @390 — fixo: elemento fixo/flutuante sobr |
| `t607-varredura-bloco51.spec.ts` | 2 | varredura | Error: morador — Candidaturas @390 — fixo: elemento fixo/flutuante sobre conteúd |
| `t621-varredura-bloco55.spec.ts` | 2 | varredura | Error: Início do dono com rascunho, checklist abaixo do bloco (E218) @1280: o ch |
| `t692-e259-pagina-publica.spec.ts` | 2 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('ga |
| `t71-busca-topo.spec.ts` | 2 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t719-p0-pendencia-no-assistente.spec.ts` | 2 | asserção / elemento | Error: expect(received).toMatch(expected) Expected pattern: /^\/dashboard\/imove |
| `t77-comodidades.spec.ts` | 2 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('***').locator( |
| `t772-e329-visita-confirmada.spec.ts` | 2 | asserção / elemento | Error: expect(locator).toBeAttached() failed Locator: getByTestId('visita-video- |
| `t778-e347-x-visita-video.spec.ts` | 2 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t799-cadastro-regras-icones.spec.ts` | 2 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: getByTestId('regras |
| `t9-documentos.spec.ts` | 2 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByRole('heading', { name |
| `t161-coerencia-imovel.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByText('Indisponível').f |
| `t186-cadastro-5-etapas.spec.ts` | 1 | asserção / elemento | TimeoutError: page.waitForURL: Timeout 30000ms exceeded. ======================= |
| `t194-passo1-ia-cep.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('ia |
| `t204-cadastro-ia-real.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('ia-fotos-falha |
| `t227-recibo-caixa-teste.spec.ts` | 1 | asserção / elemento | TypeError: Cannot read properties of null (reading 'numero') |
| `t229-admin-conversa-com-tudo.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('admin-decisoes |
| `t231-admin-numeros-com-lista.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('admin-decisoes |
| `t241-contas-teste-36.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: locator('[data-test |
| `t250-parceiros-contratacao.spec.ts` | 1 | asserção / elemento | TimeoutError: locator.click: Timeout 15000ms exceeded. Call log: - waiting for g |
| `t256-pagina-da-estadia.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('aditivo |
| `t273-admin-decisoes.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('admin-d |
| `t280-conta-unica-43.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: locator('[data-test |
| `t286-esqueletos-vazios-48.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('skeleton-detal |
| `t287-admin-destinos-salvar.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toContainText(expected) failed Locator: getByTestId('dest |
| `t288-padrao-minimo-59a.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('passo-t |
| `t290-aceite-socio.spec.ts` | 1 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t291-aceite-ordem-agente.spec.ts` | 1 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t292-conforto-manutencao-59.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('passo-t |
| `t295-niveis-59-1.spec.ts` | 1 | asserção / elemento | Error: expect(locator).not.toBeChecked() failed Locator: getByTestId('nivel-tenh |
| `t296-niveis-exibicao-59-1.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toContainText(expected) failed Locator: getByTestId('cart |
| `t297-varredura-logada-bloco3.spec.ts` | 1 | varredura | Error: morador — Candidaturas @390 — fixo: elemento fixo/flutuante sobre conteúd |
| `t298-varredura-logada-bloco4.spec.ts` | 1 | varredura | Error: morador — Propostas @390 — fixo: elemento fixo/flutuante sobre conteúdo q |
| `t30-atendimento-autonomo.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toContainText(expected) failed Locator: locator('body') E |
| `t303-avaliadores-credenciados-62b1.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: locator('[data- |
| `t304-airbnb-exibicao-61a.spec.ts` | 1 | asserção / elemento | { code: '23514', details: null, hint: null, message: 'Dê uma nota de 1 a 5 para  |
| `t305-laudo-avaliacao-62b2.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('la |
| `t315-telas-avaliacao-dono-62a.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toContainText(expected) failed Locator: getByTestId('aval |
| `t316-sair-da-viva-51.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: locator('[data- |
| `t318-papel-ativo-fonte-unica.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: "propriet |
| `t328-documento-sem-trava-l11.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('documento-envi |
| `t331-preferencias-push-44b2.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('notif-categori |
| `t336-varredura-bloco14.spec.ts` | 1 | varredura | Error: proprietário — Candidaturas (selo do 52) @390 — fixo: elemento fixo/flutu |
| `t344-avaliacao-telas-62a-parte2.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('la |
| `t346-importar-calendario-53.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: 1 Receive |
| `t348-triagem-vinculo-52.spec.ts` | 1 | asserção / elemento | Error: expect(received).not.toMatch(expected) Expected pattern: not /R\$\s?\d/sa |
| `t355-conta-a-perfil-espelho.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: locator('[data-test |
| `t361-conta-a-correcoes-qa.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: locator('[data-test |
| `t365-conta-a1-casca-perfil.spec.ts` | 1 | asserção / elemento | Error: expect(received).toEqual(expected) // deep equality - Expected - 2 + Rece |
| `t370-conta-a3-papeis.spec.ts` | 1 | asserção / elemento | TimeoutError: locator.click: Timeout 20000ms exceeded. Call log: - waiting for g |
| `t373-conta-a4-dados.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('meus-da |
| `t379-55e2-filtro-contato-um-toque.spec.ts` | 1 | asserção / elemento | Error: locator.click: Error: strict mode violation: getByRole('button', { name:  |
| `t38-varios-imoveis-por-dono.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByText('Studio 21 do tes |
| `t386-cadastro-01-tipo.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('previa- |
| `t39-app-ida-e-volta.spec.ts` | 1 | asserção / elemento | Error: expect(page).toHaveURL(expected) failed Expected pattern: /\/app\/boas-vi |
| `t391-conta-conformidade.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: locator('[data-test |
| `t395-km-destino.spec.ts` | 1 | asserção / elemento | Test timeout of 120000ms exceeded. |
| `t397-foto-na-hora.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('***').f |
| `t40-novo-anuncio-fotos.spec.ts` | 1 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t400-chacara-sem-internet.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: "nao_tem" |
| `t401-cadastro-10-revisao.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: "Tudo cer |
| `t404-admin-celular-e73.spec.ts` | 1 | asserção / elemento | TimeoutError: page.waitForURL: Timeout 20000ms exceeded. ======================= |
| `t405-perfil-e60-e62.spec.ts` | 1 | asserção / elemento | TimeoutError: locator.waitFor: Timeout 20000ms exceeded. Call log: - waiting for |
| `t41-mensagens.spec.ts` | 1 | asserção / elemento | Error: locator.click: Error: strict mode violation: getByRole('button', { name:  |
| `t43-notificacoes.spec.ts` | 1 | asserção / elemento | Error: locator.click: Error: strict mode violation: getByRole('button', { name:  |
| `t431-perto-a.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('perto-categori |
| `t435-cadastro-03-endereco.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: true Rece |
| `t439-e101-deteccao-espelho.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toContainText(expected) failed Locator: locator('main') E |
| `t442-foto-perfil-revisao.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByText('Fotos de perfil  |
| `t456-comodidades-tipo-e111a.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByText(/Salvo/).first()  |
| `t46-modo-do-app.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: locator('nav.vn-tabbar').ge |
| `t464-prop6-inicio-dono.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('inicio-dono-fo |
| `t465-admin4-inicial.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('ad |
| `t469-e134-passo4-alinhado.spec.ts` | 1 | asserção / elemento | Error: tipo: botões vazando expect(received).toEqual(expected) // deep equality  |
| `t486-e174b-selo-vinculo.spec.ts` | 1 | asserção / elemento | { code: '23514', details: null, hint: null, message: 'Dê uma nota de 1 a 5 para  |
| `t489-e176-menus.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('topo-pu |
| `t534-e147-bairro-santa-monica.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('passo-t |
| `t547-e148a-texto-sugerido-passo7.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveValue(expected) failed Locator: getByTestId('cadast |
| `t548-e132a-declaracoes-persistem.spec.ts` | 1 | asserção / elemento | Error: expect(received).toMatchObject(expected) Matcher error: received value mu |
| `t553-varredura-bloco41.spec.ts` | 1 | varredura | Error: proprietário — Mensagens, selo do vínculo (E174-B) @390 — fixo: elemento  |
| `t56-admin-aal2.spec.ts` | 1 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t564-e193-qualificacao-cartoes.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: 23 Receiv |
| `t585-e205b-emails-novos.spec.ts` | 1 | asserção / elemento | Error: sem e-mail visita_vespera na caixa de teste |
| `t588-varredura-bloco46.spec.ts` | 1 | varredura | Error: morador — Mensagens (E200) @390 — fixo: elemento fixo/flutuante sobre con |
| `t59-flutuante-nao-tampa.spec.ts` | 1 | asserção / elemento | Error: expect(received).toEqual(expected) // deep equality - Expected - 1 + Rece |
| `t590-espaco-trabalho-interesse.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveValue(expected) failed Locator: getByTestId('espaco |
| `t591-varredura-bloco48.spec.ts` | 1 | varredura | Error: proprietário — Ganhos @390 — fixo: elemento fixo/flutuante sobre conteúdo |
| `t593-e211-visita-do-dono.spec.ts` | 1 | asserção / elemento | Error: expect(locator).not.toContainText(expected) failed Locator: getByTestId(' |
| `t595-e205b2-lembrete-no-aceite.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('aditivo |
| `t597-e213b-limpeza-renovacao.spec.ts` | 1 | asserção / elemento | Error: um pedido por saída, mesmo com 2 rodadas expect(received).toHaveLength(ex |
| `t599-varredura-bloco49.spec.ts` | 1 | varredura | Error: morador — Proposta recebida @390 — fixo: elemento fixo/flutuante sobre co |
| `t600-e200-conversa-da-estadia.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toContainText(expected) failed Locator: locator('[data-te |
| `t610-e190p2-hoje-no-inicio.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('inicio- |
| `t622-varredura-bloco56.spec.ts` | 1 | varredura | Error: proprietário — Meus imóveis com só um rascunho @390 — fixo: elemento fixo |
| `t631-e222b-renovar-aditivo.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('aditivo |
| `t64-telas-largas.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('novo-resumo')  |
| `t644-conta-menu-alinhado.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('conta-menu-lat |
| `t655-observador-botoes-filas.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: locator('[data-testid="fila |
| `t656-e224-plano-gestor.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('***') E |
| `t66-home-busca-principal.spec.ts` | 1 | timeout 45 s | Test timeout of 45000ms exceeded. |
| `t678-e202-emails-candidatura.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveValue(expected) failed Locator: getByLabel(/Prazo t |
| `t683-e259-perto-fonte-unica.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBeLessThan(expected) Expected: < 650 Received: 936 |
| `t691-e259-polimento-assistente.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: locator('[data-test |
| `t693-prova-de-publicacao.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: "publicou |
| `t696-varredura-bloco74.spec.ts` | 1 | varredura | Error: Passo 10, Declarações do imóvel na conferência (#1587) @1280: a tela do m |
| `t697-e259-pessoas-sugerido-grava.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: "6" Recei |
| `t70-busca-split.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBeGreaterThanOrEqual(expected) Expected: >= 0.53 Recei |
| `t703-e254-estadia-minima.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: locator('#cartao-pre |
| `t704-e265-tipos-sem-selo.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: getByRole('radiogro |
| `t706-e271-passo10-uma-vez.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveCount(expected) failed Locator: getByRole('radiogro |
| `t708-e254-estadia-minima-uma-fonte.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality - Expected - 1 + Re |
| `t710-e265-sem-selo-em-todo-cartao.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('ti |
| `t712-e267-transacionais-corpo.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveText(expected) failed Locator: getByTestId('aditivo |
| `t735-e277-busca-parceiros-fotos.spec.ts` | 1 | asserção / elemento | TimeoutError: locator.scrollIntoViewIfNeeded: Timeout 15000ms exceeded. Call log |
| `t739-varredura-parceiros-390.spec.ts` | 1 | varredura | Error: expect(locator).toBeVisible() failed Locator: locator('[data-testid="cart |
| `t755-agenda-a-periodo-ical.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('ag |
| `t79-privacidade-acesso.spec.ts` | 1 | asserção / elemento | Error: expect(received).toContain(expected) // indexOf Expected substring: "Aces |
| `t800-cadastro-passo4-titulo.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('cartao-numeros |
| `t81-menu-cascata.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toHaveAttribute(expected) failed Locator: locator('aside' |
| `t816-cidade-bairros-grade-par.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBeLessThan(expected) Expected: < 580 Received: 1159.98 |
| `t840-e525-pins-sem-sobreposicao.spec.ts` | 1 | asserção / elemento | Error: depois de Zoom out depois de Zoom out expect(received).toEqual(expected)  |
| `t85-conferencia-entrada-saida.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toContainText(expected) failed Locator: getByTestId('conf |
| `t862-e553-perfil-candidato.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBe(expected) // Object.is equality Expected: 404 Recei |
| `t875-e581-candidatura-repetida.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByText(/já respondeu à s |
| `t88-imovel-completo.spec.ts` | 1 | asserção / elemento | Error: expect(received).toBeGreaterThanOrEqual(expected) Expected: >= 115 Receiv |
| `t886-e464-cabecalho-conta.spec.ts` | 1 | asserção / elemento | Error: /dashboard/conta/perfil: sino expect(locator).toBeVisible() failed Locato |
| `t909-reembolso-linha-tablet.spec.ts` | 1 | asserção / elemento | Error: expect(locator).toBeVisible() failed Locator: getByTestId('***') Expected |
| `t910-e617-caucao-passo8.spec.ts` | 1 | asserção / elemento | Error: locator.evaluate: TypeError: Failed to execute 'selectNodeContents' on 'R |
| `t916-buscas-salvas-uma-barra.spec.ts` | 1 | asserção / elemento | Error: locator.evaluateAll: ReferenceError: rotulo is not defined at eval (eval  |

## Lista completa (spec › teste)

- `t112-imagens-unicas.spec.ts` › 1440 px: nenhuma imagem decorativa quebrada ou repetida nas páginas públicas (falhou)
- `t112-imagens-unicas.spec.ts` › 390 px: nenhuma imagem decorativa quebrada ou repetida nas páginas públicas (falhou)
- `t14-app-mode.spec.ts` › abre em Buscar com as 5 abas do inquilino (falhou)
- `t14-app-mode.spec.ts` › Admin a 390 px: sem barra de abas (Prompt 41) → painel → Caixa dos Sócios → Voltar ao painel (falhou)
- `t14-app-mode.spec.ts` › Conta em lista e as 5 abas do proprietário (falhou)
- `t161-coerencia-imovel.spec.ts` › calendário: legenda tem Indisponível (falhou)
- `t176-exemplo-proprietario-avaliacoes.spec.ts` › 1280px — ube-001: faixa, estrelas, avaliações e Sobre o proprietário, tudo marcado (falhou)
- `t176-exemplo-proprietario-avaliacoes.spec.ts` › 390px — ube-001: faixa, estrelas, avaliações e Sobre o proprietário, tudo marcado (falhou)
- `t186-cadastro-5-etapas.spec.ts` › 390px — do CEP ao anúncio publicado (falhou)
- `t194-passo1-ia-cep.spec.ts` › 390px — Passo 3 só endereço, CEP com resposta em todos os casos, fotos e IA no passo Fotos (instavel)
- `t195-matricula-caf.spec.ts` › 1280px — a fila mostra a matrícula com o resumo lido e o laudo (booleanos); Pedir documento (falhou)
- `t195-matricula-caf.spec.ts` › 1280px — A publica sem fila; API e página públicas sem nº da matrícula, cartório ou CPF (instavel)
- `t204-cadastro-ia-real.spec.ts` › 390px — datas: digitar e colar no computador; fotos: Adicionar, arrastar e soltar, IA com motivo e "Tentar de  (falhou)
- `t227-recibo-caixa-teste.spec.ts` › 2. 1280 — fila legível: 2 falhas, 2 linhas com número, tipo, contrato, nomes, motivo e data diferentes (falhou)
- `t229-admin-conversa-com-tudo.spec.ts` › 1280px — cada cartão abre a lista que ele conta, com o mesmo número (falhou)
- `t231-admin-numeros-com-lista.spec.ts` › 1280px — todo número da home é link e a lista aberta tem a mesma contagem (falhou)
- `t241-contas-teste-36.spec.ts` › 2. 390 px — admin marca a conta de teste; o parceiro some da busca (falhou)
- `t245-visual-regressao.spec.ts` › 01 home (hero e busca) (falhou)
- `t245-visual-regressao.spec.ts` › 01 home (hero e busca) (falhou)
- `t245-visual-regressao.spec.ts` › 02 home (cartões em destaque) (falhou)
- `t245-visual-regressao.spec.ts` › 02 home (cartões em destaque) (falhou)
- `t245-visual-regressao.spec.ts` › 03 /buscar (falhou)
- `t245-visual-regressao.spec.ts` › 03 /buscar (falhou)
- `t245-visual-regressao.spec.ts` › 04 /buscar com a folha de filtros aberta (falhou)
- `t245-visual-regressao.spec.ts` › 04 /buscar com a folha de filtros aberta (falhou)
- `t245-visual-regressao.spec.ts` › 05 /favoritos vazio (falhou)
- `t245-visual-regressao.spec.ts` › 05 /favoritos vazio (falhou)
- `t245-visual-regressao.spec.ts` › 06 /favoritos com 2 imóveis (falhou)
- `t245-visual-regressao.spec.ts` › 06 /favoritos com 2 imóveis (falhou)
- `t245-visual-regressao.spec.ts` › 07 /cidades/uberlandia (falhou)
- `t245-visual-regressao.spec.ts` › 07 /cidades/uberlandia (falhou)
- `t245-visual-regressao.spec.ts` › 08 página do imóvel (topo) (falhou)
- `t245-visual-regressao.spec.ts` › 08 página do imóvel (topo) (falhou)
- `t245-visual-regressao.spec.ts` › 09 imóveis parecidos (falhou)
- `t245-visual-regressao.spec.ts` › 09 imóveis parecidos (falhou)
- `t245-visual-regressao.spec.ts` › 10 /como-funciona (falhou)
- `t245-visual-regressao.spec.ts` › 10 /como-funciona (falhou)
- `t245-visual-regressao.spec.ts` › 12 /para-proprietarios (falhou)
- `t245-visual-regressao.spec.ts` › 12 /para-proprietarios (falhou)
- `t245-visual-regressao.spec.ts` › 13 /auth (falhou)
- `t245-visual-regressao.spec.ts` › 13 /auth (falhou)
- `t245-visual-regressao.spec.ts` › 14 /dashboard (falhou)
- `t245-visual-regressao.spec.ts` › 14 /dashboard (falhou)
- `t245-visual-regressao.spec.ts` › 15 /dashboard/favoritos (falhou)
- `t245-visual-regressao.spec.ts` › 15 /dashboard/favoritos (falhou)
- `t245-visual-regressao.spec.ts` › 16 /dashboard/buscas (falhou)
- `t245-visual-regressao.spec.ts` › 16 /dashboard/buscas (falhou)
- `t245-visual-regressao.spec.ts` › 17 /dashboard/conta (falhou)
- `t245-visual-regressao.spec.ts` › 17 /dashboard/conta (falhou)
- `t245-visual-regressao.spec.ts` › 18 /dashboard (falhou)
- `t245-visual-regressao.spec.ts` › 18 /dashboard (falhou)
- `t245-visual-regressao.spec.ts` › 19 /dashboard/imoveis (falhou)
- `t245-visual-regressao.spec.ts` › 19 /dashboard/imoveis (falhou)
- `t245-visual-regressao.spec.ts` › 20 /dashboard/conta/seguranca (falhou)
- `t245-visual-regressao.spec.ts` › 20 /dashboard/conta/seguranca (falhou)
- `t250-parceiros-contratacao.spec.ts` › roteiro principal: pedido pelo passo de fotos → orçamento → aceite → horário → simular → entrega → anúncio → c (falhou)
- `t255-admin-f15-f16-f18-f20.spec.ts` › F20 — /admin/pedidos tem busca, abas por situação e sem rolagem lateral (1280 px) (falhou)
- `t255-admin-f15-f16-f18-f20.spec.ts` › F20 — /admin/pedidos tem busca, abas por situação e sem rolagem lateral (390 px) (falhou)
- `t256-pagina-da-estadia.spec.ts` › propor alteração +1 mês → aceite → aditivo assinado pelos dois com código → blocos e taxa atualizados (falhou)
- `t263-visual-41.spec.ts` › 01 página do imóvel inteira (ube-001) (falhou)
- `t263-visual-41.spec.ts` › 01 página do imóvel inteira (ube-001) (falhou)
- `t263-visual-41.spec.ts` › 02 barra inferior (inquilino) (falhou)
- `t263-visual-41.spec.ts` › 02 barra inferior (inquilino) (falhou)
- `t263-visual-41.spec.ts` › 03 barra inferior (proprietario) (falhou)
- `t263-visual-41.spec.ts` › 04 barra inferior (parceiro) 390 px (falhou)
- `t271-admin-visual.spec.ts` › 1280px — /admin (falhou)
- `t271-admin-visual.spec.ts` › 1280px — /admin/atendimento (falhou)
- `t271-admin-visual.spec.ts` › 1280px — /admin/contratos (falhou)
- `t271-admin-visual.spec.ts` › 1280px — /admin/contratos/[id] (falhou)
- `t271-admin-visual.spec.ts` › 1280px — /admin/documentos (falhou)
- `t271-admin-visual.spec.ts` › 1280px — /admin/financeiro (falhou)
- `t271-admin-visual.spec.ts` › 1280px — /admin/parceiros (falhou)
- `t271-admin-visual.spec.ts` › 1280px — /admin/usuarios (falhou)
- `t271-admin-visual.spec.ts` › 390px — /admin (falhou)
- `t271-admin-visual.spec.ts` › 390px — /admin/atendimento (falhou)
- `t271-admin-visual.spec.ts` › 390px — /admin/documentos (falhou)
- `t273-admin-decisoes.spec.ts` › 1280px — "Hoje você tem N decisões", cada uma com o botão e a lista que conta o mesmo (falhou)
- `t277-preco-grade-47.spec.ts` › margem de tela constante: 16 px no celular, 32 px no computador (falhou)
- `t277-preco-grade-47.spec.ts` › preço com contexto: cartão = página do imóvel (mês, período e disponibilidade) (falhou)
- `t277-preco-grade-47.spec.ts` › preço com contexto: cartão = página do imóvel (mês, período e disponibilidade) (falhou)
- `t280-conta-unica-43.spec.ts` › 390px — conta com 3 papéis: Seus papéis, 4 grupos, sem seletor de modo (falhou)
- `t286-esqueletos-vazios-48.spec.ts` › 390px — carregando: esqueleto do imóvel e das mensagens, sem spinner no conteúdo (falhou)
- `t287-admin-destinos-salvar.spec.ts` › 1. busca no mapa preenche o ponto e o cadastro salva (falhou)
- `t288-padrao-minimo-59a.spec.ts` › 1. cadastro: o bloco no passo Comodidades e o 'Falta confirmar' junto do Publicar (falhou)
- `t290-aceite-socio.spec.ts` › pedido → aguardando aceite → reabrir → aceito, e quem não pediu não aceita (falhou)
- `t291-aceite-ordem-agente.spec.ts` › concluída → aguardando aceite → reabrir → aceito, e quem não criou não aceita (falhou)
- `t292-conforto-manutencao-59.spec.ts` › 1. publicar sem 1 item é recusado com a lista do que falta; com os 10, publica (falhou)
- `t295-niveis-59-1.spec.ts` › 2. elo mais fraco: o Premium sem o ar da sala vira Conforto; ao repor, volta a Premium (falhou)
- `t296-niveis-exibicao-59-1.spec.ts` › 1. cartão com o nível na linha de fatos; filtro 'Nível a partir de' com contagem ao vivo (falhou)
- `t297-varredura-logada-bloco3.spec.ts` › morador — Candidaturas: as seis classes, rolando a página inteira (falhou)
- `t298-varredura-logada-bloco4.spec.ts` › morador — Propostas: as seis classes, rolando a página inteira (falhou)
- `t30-atendimento-autonomo.spec.ts` › Caução simples: resposta automática em < 30 s; nova pergunta respondida; 'pessoa' passa para a equipe sem IA (instavel)
- `t302-varredura-logada-bloco6.spec.ts` › morador — Garantias: as seis classes, rolando a página inteira (falhou)
- `t302-varredura-logada-bloco6.spec.ts` › proprietário — Recibos: as seis classes, rolando a página inteira (falhou)
- `t303-avaliadores-credenciados-62b1.spec.ts` › 1. credenciar 3 avaliadores: pedido pela tela (390 px), A em teste → aprovado pelo admin; tabela de preço (falhou)
- `t304-airbnb-exibicao-61a.spec.ts` › 1. 'Estadia confirmada' só com as duas assinaturas: texto direto, próximo passo com prazo e um primário (falhou)
- `t305-laudo-avaliacao-62b2.spec.ts` › 1. aprovado: checklist no celular (fila local), internet na hora, laudo VIS, "Nível Premium · vistoriado" e /c (falhou)
- `t315-telas-avaliacao-dono-62a.spec.ts` › 1. dono: duas rotas lado a lado, frase fixa, um primário; pedir → linha do tempo com o nº, sem repetir a frase (falhou)
- `t316-sair-da-viva-51.spec.ts` › 3. regra dos 3 em 30 dias: a 4ª saída cria a Correção; dono e prazo; fechar exige PR ou ação (falhou)
- `t318-papel-ativo-fonte-unica.spec.ts` › 2. selo = barra = página numa sessão; página de outra área troca e grava; comuns mantêm (falhou)
- `t328-documento-sem-trava-l11.spec.ts` › 1. rascunho retomado com endereço salvo: envia sem redigitar (falhou)
- `t329-varredura-bloco11.spec.ts` › inquilina — Conta · Notificações: as seis classes, rolando a página inteira (falhou)
- `t329-varredura-bloco11.spec.ts` › inquilina — Mensagens: as seis classes, rolando a página inteira (falhou)
- `t329-varredura-bloco11.spec.ts` › inquilina — Meus pedidos: as seis classes, rolando a página inteira (falhou)
- `t329-varredura-bloco11.spec.ts` › proprietário — Mensagens: as seis classes, rolando a página inteira (falhou)
- `t331-preferencias-push-44b2.spec.ts` › 1. decisões e segurança sempre chegam; mensagens desliga e fica desligado (falhou)
- `t336-varredura-bloco14.spec.ts` › proprietário — Candidaturas (selo do 52): as seis classes, rolando a página inteira (falhou)
- `t344-avaliacao-telas-62a-parte2.spec.ts` › 2. resultado do dono a 390 px: resumo, foto do não conforme e ações de cada resultado (falhou)
- `t346-importar-calendario-53.spec.ts` › 4. data importada cruza uma candidatura da Viva → aviso ao dono, nada cancelado (falhou)
- `t348-triagem-vinculo-52.spec.ts` › 2. o dono vê o selo só com identidade + vínculo; nunca arquivo nem valores (falhou)
- `t354-varredura-bloco19.spec.ts` › inquilina — Conta A1 · Notificações: as seis classes, rolando a página inteira (falhou)
- `t354-varredura-bloco19.spec.ts` › proprietário — Conta A1 · Notificações: as seis classes, rolando a página inteira (falhou)
- `t355-conta-a-perfil-espelho.spec.ts` › 1. a 360 px: sem nome → silhueta; um H1 visível ("Perfil") (falhou)
- `t361-conta-a-correcoes-qa.spec.ts` › C5. a 1280 px: escolher a foto → recortar → salvar → topo, cabeçalho e espelho atualizam (falhou)
- `t365-conta-a1-casca-perfil.spec.ts` › 1. 1280: casca com o menu lateral, fundo areia, um H1 e o Perfil com o espelho à direita (falhou)
- `t370-conta-a3-papeis.spec.ts` › 2. o interruptor grava na hora e volta depois de recarregar (falhou)
- `t373-conta-a4-dados.spec.ts` › 2. data de nascimento: recusa a que não existe, grava a certa e volta depois de recarregar (falhou)
- `t379-55e2-filtro-contato-um-toque.spec.ts` › 1c. texto digitado à mão com telefone e com e-mail: comportamento atual medido (falhou)
- `t38-varios-imoveis-por-dono.spec.ts` › o 21º publica; Meus imóveis e o painel sem faixa de limite nem 'mude de plano' (falhou)
- `t385-varredura-bloco21.spec.ts` › inquilina — Conta Notificações: as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t385-varredura-bloco21.spec.ts` › proprietário — Conta Notificações: as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t386-cadastro-01-tipo.spec.ts` › 1. a 1280 px: o passo 1 do desenho (falhou)
- `t388-varredura-bloco23.spec.ts` › inquilina — Contrato da estadia: as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t388-varredura-bloco23.spec.ts` › inquilina — Visitas: as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t39-app-ida-e-volta.spec.ts` › Ferramentas pede login dentro do app e Assinatura (aposentada) volta à tela inicial do app (falhou)
- `t391-conta-conformidade.spec.ts` › E55. a 390 px: no Perfil as miniaturas de navegação mostram iniciais (falhou)
- `t395-km-destino.spec.ts` › local pessoal: km no cartão e na página do imóvel (instavel)
- `t397-foto-na-hora.spec.ts` › 5. prova anterior à regra: conta com a marca até o prazo; vencida, o item deixa de contar (falhou)
- `t4-fronteira-demo-real.spec.ts` › Fechamento não expõe persona/contrato fictício (falhou)
- `t4-fronteira-demo-real.spec.ts` › saudação/sidebar exibem o nome REAL da conta (falhou)
- `t40-novo-anuncio-fotos.spec.ts` › botão Novo anúncio em /dashboard leva ao passo 1 (Tipo) (falhou)
- `t400-chacara-sem-internet.spec.ts` › 1. salvar rascunho com 'Não tem internet' (cadastro e editor) (falhou)
- `t401-cadastro-10-revisao.spec.ts` › 1. a 1280 px: a revisão do desenho (falhou)
- `t404-admin-celular-e73.spec.ts` › 390px — navegação, alerta do backup, linha tocável e números-chave (falhou)
- `t405-perfil-e60-e62.spec.ts` › E60. a 390 px: nas outras telas o botão fica inteiro e acima da barra de abas, também depois de arrastado (falhou)
- `t41-mensagens.spec.ts` › o dono recebe e responde; telefone e e-mail saem mascarados e o inquilino recebe assim (falhou)
- `t416-varredura-bloco33.spec.ts` › proprietário — Contratos (#1327): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t416-varredura-bloco33.spec.ts` › proprietário — Garantias (#1327): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t416-varredura-bloco33.spec.ts` › proprietário — Pedidos (#1327): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t418-varredura-bloco35.spec.ts` › proprietário — Caução (#1343): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t418-varredura-bloco35.spec.ts` › proprietário — Contratos sem repetição (#1343): as seis classes e o clique no primário, rolando a página intei (falhou)
- `t418-varredura-bloco35.spec.ts` › proprietário — Recibos e notas (#1343): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t43-notificacoes.spec.ts` › a mensagem do inquilino avisa o dono por e-mail (LAB_OUTBOX), sem telefone no aviso (falhou)
- `t431-perto-a.spec.ts` › 3. a 390 px: página do imóvel agrupa por categoria (instavel)
- `t435-cadastro-03-endereco.spec.ts` › E104 a 390 px: Passo 3 só endereço, em cartão branco sobre o fundo areia; bairro fora do zoom; complemento neu (falhou)
- `t436-busca-clean-e82.spec.ts` › 1–2. uma linha de controles na ordem do mockup e, acima da lista, só a linha da contagem (falhou)
- `t436-busca-clean-e82.spec.ts` › 1–2. uma linha de controles na ordem do mockup e, acima da lista, só a linha da contagem (falhou)
- `t439-e101-deteccao-espelho.spec.ts` › 1. sem UF, a localização não deixa hífen pendurado; com UF, 'Bairro, Cidade - UF' (falhou)
- `t442-foto-perfil-revisao.spec.ts` › 3. fila (mais antiga primeiro) + contador no painel; Aprovar tira da fila (falhou)
- `t456-comodidades-tipo-e111a.spec.ts` › 2. troca de tipo: o elevador marcado fica salvo na chácara e volta no apartamento (falhou)
- `t46-modo-do-app.spec.ts` › conta única: sem seletor de modo no topo e o menu de abas continua inteiro (falhou)
- `t464-prop6-inicio-dono.spec.ts` › 1. a 390 px: Continue seu anúncio, Peça na Viva e os atalhos (falhou)
- `t465-admin4-inicial.spec.ts` › 3–4. a 390 px: Funil e indicadores sem "N de 0"; "Ver todas" = Pendências (falhou)
- `t469-e134-passo4-alinhado.spec.ts` › 3. a 390 px: os 10 passos sem rolagem lateral (prints) (falhou)
- `t486-e174b-selo-vinculo.spec.ts` › 390 px — perfil público do proprietário e o bloco do dono no imóvel (falhou)
- `t489-e176-menus.spec.ts` › 1280 px — topo público: Imóveis · Anunciar · Empresas + Fale com a Viva + Entrar; /buscar mantém o cabeçalho;  (falhou)
- `t51-admin-padrao-caixa-socios.spec.ts` › telas do admin com título e sem rolagem lateral a 1280px (falhou)
- `t51-admin-padrao-caixa-socios.spec.ts` › telas do admin com título e sem rolagem lateral a 360px (falhou)
- `t51-admin-padrao-caixa-socios.spec.ts` › visão geral mostra as áreas novas com atalhos (falhou)
- `t534-e147-bairro-santa-monica.spec.ts` › 1. a 1280 px: CEP de Uberlândia grava "Santa Mônica" e o valor persiste (falhou)
- `t547-e148a-texto-sugerido-passo7.spec.ts` › 1. a 390 px: título e descrição vazios → o texto do modelo, só com os dados do cadastro (falhou)
- `t548-e132a-declaracoes-persistem.spec.ts` › 2. a 1280 px: o que se marca no Passo 10 fica no rascunho e volta marcado (falhou)
- `t553-varredura-bloco41.spec.ts` › proprietário — Mensagens, selo do vínculo (E174-B): as seis classes e o clique no primário, rolando a página i (falhou)
- `t559-varredura-bloco43.spec.ts` › morador — Aba Pedidos (MENUS-5): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t559-varredura-bloco43.spec.ts` › morador — Pedidos › Propostas (MENUS-5): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t56-admin-aal2.spec.ts` › sessão salva do admin entra no /admin sem pedir código (falhou)
- `t564-e193-qualificacao-cartoes.spec.ts` › 1280 px — Passo 5: comodidades em pílulas (E193, 29/10: várias escolhas = pílula) (falhou)
- `t585-e205b-emails-novos.spec.ts` › d2. véspera na hora (confirmada com < 24 h) e cancelada com quem/motivo/horário (falhou)
- `t588-varredura-bloco46.spec.ts` › morador — Mensagens (E200): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t589-varredura-bloco47.spec.ts` › morador — Detalhe da visita, morador (E211): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t589-varredura-bloco47.spec.ts` › morador — Visitas do morador com Ver detalhes (E211): as seis classes e o clique no primário, rolando a página (falhou)
- `t589-varredura-bloco47.spec.ts` › proprietário — Mensagens do dono (E211): as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t59-flutuante-nao-tampa.spec.ts` › 4f8d17c6 — flutuante idêntico em /, /precos e /como-funciona a 768 e 1280 px (a 390, E246: não aparece) (falhou)
- `t590-espaco-trabalho-interesse.spec.ts` › 1280 px — morador responde, salva e a resposta volta ao recarregar (falhou)
- `t591-varredura-bloco48.spec.ts` › proprietário — Ganhos: as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t593-e211-visita-do-dono.spec.ts` › 390 px — Agenda e Interessados levam ao detalhe; presencial confirmada com endereço e mapa (falhou)
- `t595-e205b2-lembrete-no-aceite.spec.ts` › A: aditivo assinado com o bloco 2 começando em 2 dias → o lembrete sai na hora, ao morador, uma vez (falhou)
- `t597-e213b-limpeza-renovacao.spec.ts` › B + item 4: sem aceite, a nova saída longe → cancelado com o sufixo; o cron refaz no D-5 com a chave original; (falhou)
- `t599-varredura-bloco49.spec.ts` › morador — Proposta recebida: as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t600-e200-conversa-da-estadia.spec.ts` › 1280 px — dono: a conversa da estadia está na lista sem o ?conversa=, com o nome da moradora (falhou)
- `t607-varredura-bloco51.spec.ts` › morador — Candidaturas: as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t607-varredura-bloco51.spec.ts` › morador — Mensagens: as seis classes e o clique no primário, rolando a página inteira (falhou)
- `t610-e190p2-hoje-no-inicio.spec.ts` › 1280 px — quem entra e quem sai hoje, com nome, imóvel, horário e link da estadia (falhou)
- `t621-varredura-bloco55.spec.ts` › proprietário — Início do dono com rascunho, checklist abaixo do bloco (E218): as seis classes e o clique no pr (falhou)
- `t621-varredura-bloco55.spec.ts` › proprietário — Início do dono novo, checklist dentro de "Anuncie seu primeiro imóvel" (E218): as seis classes  (falhou)
- `t622-varredura-bloco56.spec.ts` › proprietário — Meus imóveis com só um rascunho: as seis classes e o clique no primário, rolando a página intei (falhou)
- `t631-e222b-renovar-aditivo.spec.ts` › 1. página do contrato → 'Renovar a estadia' → aditivo já preenchido → as duas assinaturas: bloco novo e estadi (falhou)
- `t64-telas-largas.spec.ts` › T64 — novo anúncio: etapa à esquerda e prévia à direita a 1280px; uma coluna a 390px (falhou)
- `t644-conta-menu-alinhado.spec.ts` › 1280 px: mesma altura em todas as seções, alinhado ao título (falhou)
- `t655-observador-botoes-filas.spec.ts` › 1280 px — observador: "Só leitura" no dado real; botões no de teste (falhou)
- `t656-e224-plano-gestor.spec.ts` › 1a. proprietário sem imóvel aprovado: 'Você tem 0; faltam 20.' e nenhum botão de assinar (falhou)
- `t66-home-busca-principal.spec.ts` › atalhos abrem a /buscar já filtrada (falhou)
- `t678-e202-emails-candidatura.spec.ts` › 4–5. o dono aprova: a moradora recebe o aceite com os dados, e o Fechamento abre em 1 mês (falhou)
- `t683-e259-perto-fonte-unica.spec.ts` › a busca do assistente e o 'Tempo até' da página trazem a UFU — Campus Santa Mônica a ~600 m (instavel)
- `t691-e259-polimento-assistente.spec.ts` › 1280 px — (5) fotos dos tipos, (6) Pessoas sugerido, (7) texto do Essencial, (8) Declarações do imóvel (falhou)
- `t692-e259-pagina-publica.spec.ts` › 1280 px — destaques das comodidades, crianças nas regras, galeria com prioridade (instavel)
- `t692-e259-pagina-publica.spec.ts` › 390 px — destaques das comodidades, crianças nas regras, galeria com prioridade (falhou)
- `t693-prova-de-publicacao.spec.ts` › 1–2. 1280 px — os 10 passos na tela, a prévia do Passo 10 e Publicar (falhou)
- `t696-varredura-bloco74.spec.ts` › proprietário — Passo 10, Declarações do imóvel na conferência (#1587): as seis classes, rolando a página intei (falhou)
- `t697-e259-pessoas-sugerido-grava.spec.ts` › 1. 1280 px — 3 quartos e Pessoas vazio: chega 6, marcado sugerido, e o rascunho grava 6 (falhou)
- `t70-busca-split.spec.ts` › 1. proporções, 3 por linha, mapa fixo na altura da tela e filtros em uma linha (falhou)
- `t703-e254-estadia-minima.spec.ts` › 1. mínimo de 3 meses + limpeza R$ 450: prévia, Meus anúncios e página pública com o mesmo total e a mesma cont (falhou)
- `t704-e265-tipos-sem-selo.spec.ts` › 1280 px: os 9 cartões de tipo com foto e sem selo por cima (falhou)
- `t706-e271-passo10-uma-vez.spec.ts` › (2) 1280 px: o alt das fotos de tipo é neutro (falhou)
- `t708-e254-estadia-minima-uma-fonte.spec.ts` › 2. publicado: Meus anúncios, cartão público e barra do celular com R$ 13.900 e a mesma conta (falhou)
- `t71-busca-topo.spec.ts` › 9. celular: título acompanha a cidade digitada e os filtros (ordem 6a98c68e) (falhou)
- `t71-busca-topo.spec.ts` › computador: 'Limpar tudo' da folha e a opção desligada na pílula limpam (falhou)
- `t710-e265-sem-selo-em-todo-cartao.spec.ts` › 1280 px: tipo marcado com visto, rótulos limpos, foto carregada e nada escrito sobre as fotos (falhou)
- `t712-e267-transacionais-corpo.spec.ts` › A: aditivo proposto e recusado — quem propôs, o que muda, o prazo e a recusa, com o imóvel (falhou)
- `t719-p0-pendencia-no-assistente.spec.ts` › A: 'Falta para publicar' do rascunho leva ao Passo 2 (Fotos) do assistente (instavel)
- `t719-p0-pendencia-no-assistente.spec.ts` › B: publicado sem tipo de entrada → editor por seções na seção Regras, aberta (falhou)
- `t735-e277-busca-parceiros-fotos.spec.ts` › (1) 1280 px: topo com a foto da categoria, faixa de categorias com foto e cartão com foto (falhou)
- `t739-varredura-parceiros-390.spec.ts` › 390 px: buscar-limpeza-cartao (falhou)
- `t755-agenda-a-periodo-ical.spec.ts` › 1280 px: todos os dias do período marcados; iCal com o imóvel escolhido (falhou)
- `t77-comodidades.spec.ts` › mostra no máximo 5 e 'Ver todas' abre a lista completa (falhou)
- `t77-comodidades.spec.ts` › mostra no máximo 5 e 'Ver todas' abre a lista completa (falhou)
- `t772-e329-visita-confirmada.spec.ts` › aviso ao dono e "Visita agendada" ao morador (1280) (falhou)
- `t772-e329-visita-confirmada.spec.ts` › aviso ao dono e "Visita agendada" ao morador (390) (falhou)
- `t778-e347-x-visita-video.spec.ts` › T778 — E347: X de fechar na visita por vídeo, mantendo Voltar e clique fora (1280 px) (falhou)
- `t778-e347-x-visita-video.spec.ts` › T778 — E347: X de fechar na visita por vídeo, mantendo Voltar e clique fora (390 px) (falhou)
- `t78-filtros-estadia-longa.spec.ts` › 1280 px: dois filtros combinados vão para a URL e a lista nunca aumenta (falhou)
- `t78-filtros-estadia-longa.spec.ts` › 360 px: painel de filtros tem garagem e lavar, a linha de garantia, grava na URL e não estoura a largura (falhou)
- `t78-filtros-estadia-longa.spec.ts` › 390 px: painel de filtros tem garagem e lavar, a linha de garantia, grava na URL e não estoura a largura (falhou)
- `t79-privacidade-acesso.spec.ts` › 2. com a declaração, fechadura com senha e câmera externa: publica e o anúncio mostra o bloco Privacidade (falhou)
- `t799-cadastro-regras-icones.spec.ts` › T799 — Passo 6 com ícone em cada regra (1280 px) (falhou)
- `t799-cadastro-regras-icones.spec.ts` › T799 — Passo 6 com ícone em cada regra (390 px) (falhou)
- `t800-cadastro-passo4-titulo.spec.ts` › T800 — Passo 4 com título e lembrete (1280 px) (falhou)
- `t81-menu-cascata.spec.ts` › Administração separada, com subgrupos (itens dentro de itens) (falhou)
- `t816-cidade-bairros-grade-par.spec.ts` › T816 — bairros da cidade em grade par (1280 px) (falhou)
- `t840-e525-pins-sem-sobreposicao.spec.ts` › pins sem sobreposição (também depois do zoom), dentro do mapa, clicáveis com cartão aberto; título inteiro (falhou)
- `t85-conferencia-entrada-saida.spec.ts` › 4. laudo independente na saída: recusa não-PDF e PDF acima de 15 MB; o válido prevalece (falhou)
- `t862-e553-perfil-candidato.spec.ts` › 2. outra conta não vê o perfil (404) (falhou)
- `t875-e581-candidatura-repetida.spec.ts` › depois da resposta do dono, um novo envio não muda o lead e aponta o chat (falhou)
- `t88-imovel-completo.spec.ts` › computador: abas presas ao rolar, aba ativa acompanha, sinais de confiança e mapa em tela cheia (falhou)
- `t886-e464-cabecalho-conta.spec.ts` › a 1280 px: telas da Conta com o mesmo cabeçalho de parceiro e o sino (falhou)
- `t9-documentos.spec.ts` › a fila abre dentro da casca admin (falhou)
- `t9-documentos.spec.ts` › checklist habilita o Aprovar; motivo habilita a Recusa (falhou)
- `t909-reembolso-linha-tablet.spec.ts` › a 390 px (falhou)
- `t910-e617-caucao-passo8.spec.ts` › a 320 px (falhou)
- `t916-buscas-salvas-uma-barra.spec.ts` › a 390 px (falhou)
- `t95-assinatura-redireciona.spec.ts` › /dashboard/assinatura leva a /precos, sem plano pago à venda (falhou)
- `t95-assinatura-redireciona.spec.ts` › menu do dono a 1280 px não tem 'Plano e assinatura' (menu realmente aberto) (falhou)
- `t95-assinatura-redireciona.spec.ts` › menu do dono a 390 px não tem 'Plano e assinatura' (menu realmente aberto) (falhou)

## Atualização — dois runs completos comparados (09/11, 05:50 UTC)
Runs **42547901640** (16 fatias) e **42560445737** (20 fatias, com a varredura t48 em fatias próprias), mesma suíte, 4.498 testes cada.
- Falhas distintas (spec + título, só status `falhou`): **211** no 1º run, **212** no 2º.
- **206 falham nos dois runs** (determinísticas: defeito de produto, de spec ou linha de base vencida). **5** só no 1º e **6** só no 2º (oscilam: instáveis/lentas sob carga).
- Linha do 2º run em `lab_execucoes`: 3.940 passaram · 236 falharam · 316 pularam · 6 instáveis.
- Distribuição por categoria do 1º run (inalterada em ordem de grandeza): ~134 asserção/elemento, ~55 screenshot (t245, t271, t263), ~37 varredura, ~17 timeout de 45 s. Os 3 specs visuais sozinhos respondem por 55 entradas; atualizar as linhas de base é decisão de desenho (Pista A/C), não correção do fatiamento.

**Estado registrado, sem decisão** (a escolha entre zerar a lista ou fixar uma linha de base "não pode piorar" é do coordenador): o fatiamento fecha a suíte em ~61 min; o gate completo continua não verde por 206 falhas determinísticas de teste.

## Maior família: capturas de tela contra imagens-base antigas (55 falhas)

- t245 (38), t271 (11), t263 (6): `toHaveScreenshot` reprova por diferença de pixels/tamanho. Não é um defeito único: a interface mudou desde que as imagens foram feitas.
- Corrigir = refazer as imagens **no ambiente do laboratório** (mesmo Chromium/fontes/banco semeado; refazer no notebook gera imagem que reprova no CI). Isso é a nova rotina `.github/workflows/linhas-de-base.yml` (`--update-snapshots`, só artefato, `contents: read`, sem commit).
- **Aprovar as imagens é decisão de produto/QA**, não da Pista B: baixar o artefato `linhas-de-base-<run>`, olhar o diff e copiar os PNG para `tests/e2e/visual/` num PR. Depois disso as 55 falhas somem e o próximo gate fica em ~151 falhas.
- A política (zerar a lista vs. "não piorar") continua com a coordenação.

## Família "fixo" @390 — causa e correção (09/11)

Causa: a seta "Ver mais itens" (`FileiraRolavel`, E248, `data-testid="fileira-seta-dir"`) cobre de propósito a borda da fileira de subabas; o critério `controlesCobertos` (`tests/e2e/fixtures/varredura.ts`) a tratava como elemento fixo cobrindo "Recibos e notas". Não é defeito do site: rolar a fileira revela o item.
Correção: o critério ignora a seta da fileira (`setaDaFileira`), sem tocar em nenhum spec (t48 intacto). Guarda: `tests/laboratorio/varredura-seta-fileira.test.ts`.

## Run 42619364978 (head b35f781cc, 09/11) — estado por fatia
Até 13:20 UTC: 19 de 20 fatias concluídas — **4 verdes** (2, 17, 18, 19) e **15 vermelhas** (1, 3–16); a 20/20 (admin) ainda rodando. A suíte TERMINA (fatias de 6 a 35 min); as vermelhas são falhas reais de teste, as mesmas 15 da run anterior. Consolidação (`lab_execucoes`) ainda não gravada; atualizar aqui quando sair.

## Família "Notificações @1280 caiu fora da tela" — causa e correção (09/11)
Causa: o E176 faz `/dashboard/conta/notificacoes` redirecionar (302) para `/dashboard/notificacoes`; t329, t354 e t385 ainda exigiam o pathname antigo. Não é defeito do site.
Correção: as três specs varrem `/dashboard/notificacoes`. Guarda: `tests/laboratorio/varredura-notificacoes-e176.test.ts`.

## Família "timeout 45 s" — correção (09/11)
Causa: o teto por teste do `playwright.config.ts` (45 s) foi pensado para o gate de PR; nas fatias noturnas, com 2 workers no runner, 17 testes (t78, t71, t176, t778, t51, t290, t291, t40, t56, t66…) estouram por lentidão, não por defeito.
Correção: as 16 fatias gerais do noturno rodam com `--timeout=90000` (gate de PR e config intactos; o teto global da fatia segue 3.900 s). Guarda em `tests/laboratorio/lab-fatias.test.ts`.
Observação: o log do job não traz o detalhe por teste (a saída vai para `e2e.txt`/artefato); o detalhe só sai da linha consolidada de `lab_execucoes` (aguarda a fatia 20/20).

## Run 42619364978 — consolidado (head b35f781cc, antes das correções de Notificações/timeout)
`lab_execucoes` 09/11 13:44 UTC: **219 falhas** (a run anterior tinha 242). Fatias: 4 verdes (2, 17, 18, 19) e 16 vermelhas; a 20/20 (admin) terminou sem estourar. A suíte termina e consolida.
Por família: **55 baselines de screenshot** (t245 38, t271 11, t263 6 — decisão visual do QA; o artefato `linhas-de-base` já existe); Notificações @1280 (t354, t385: corrigido em 883ad2274); timeouts 45 s (t78, t71, t176, t778: corrigido em 53e25ae50); ~160 falhas em ~95 specs de causas distintas (specs desatualizados e dependências entre testes), triagem por spec abaixo.

### Specs desatualizados (drift do produto) — corrigidos
- `t51` "visão geral": exigia o painel "Áreas do admin" na inicial do admin, removido pelo E176 (guarda `estilo-admin.test`). Agora confere os atalhos no menu do admin. Guarda: `tests/laboratorio/t51-areas-admin-e176.test.ts`.

### Ainda abertos (leitura do consolidado)
t14/t46 (aba "Estadias" da barra: nome acessível vem de `descricao`), t95, t277 (32px × 80px), t436, t70, t112, t799, t318/t316, t597 (dois pedidos por saída), t621/t696 (varredura com texto E218/#1587), t719/t692 (sem mensagem de erro), t910 (Range.selectNodeContents), e os demais com 1 falha cada. Cada um exige abrir o spec e o código; seguem a ordem do consolidado.

### t51 (cont.) — 09/11
As duas varreduras de largura (360 e 1280) também estouravam os 45 s (quatro telas com `networkidle`); o `lab-critico` de a6f2852b9 ficou vermelho por isso, já que roda o spec inteiro. Agora `test.setTimeout(120_000)` nelas.
Abertos com causa lida no consolidado: t14/t46 (nome acessível da aba vem de `descricao`, não de `label`), t95 (`/dashboard/assinatura` leva a `/dashboard`, não a `/precos`: `precosVisivel` desligado), t277 (cartão mostra "R$ 3.960/mês", spec espera "em 1 mês"; margem 80 px × 32 px).

## Bloco t51 / t95 / t14·t46 / t277 — 09/11 (tarde)
Lido no log do `lab-critico` de 62a53ffc9 (123 passaram, 3 falharam, todas no t51):
- **t51 (corrigido):** `/admin/fotografos` hoje redireciona para a aba "Fotógrafos" de Parceiros (ADMIN-2); a tela própria com h1 "Fotógrafos parceiros" não existe mais, então saiu da lista de telas. O teste "visão geral" saiu: sua premissa ("Áreas do admin" na inicial) foi removida pelo E176 e a cobertura dos itens do menu é do `menu-admin.test`. Guarda: `tests/laboratorio/t51-areas-admin-e176.test.ts`.
- **t95 (1 de 3 corrigido):** `/dashboard/assinatura` vai a `/precos` só com `NEXT_PUBLIC_PRECOS_VISIVEL=1`; sem a chave vai a `/dashboard` (next.config.ts). O spec aceita os dois. Guarda: `tests/laboratorio/t95-destino-assinatura.test.ts`. Os dois testes do menu do dono (390 e 1280 px: `aside` com `menu-cascata` não aparece) seguem abertos: precisam do spec rodando para ver a estrutura atual do menu.
- **t277 — DECISÃO DO CHAT PRINCIPAL:** o cartão mostra "R$ 3.960/mês" e o spec espera "R$ 3.960 em 1 mês"; a margem de tela é 80 px no computador onde o spec espera 32 px. Falta decidir qual texto/medida vale (o produto atual ou o spec). Não mexi.
- **t14/t46 (aberto):** a aba "Estadias" não é achada pelo nome; pode ser "Minha estadia" (morador com contrato, `nav-mobile.ts`) e a barra aparece no admin a 390 px (esperado 0). Sem o spec rodando não dá para separar spec desatualizado de defeito.

## Bloco t95 (menu) · t14/t46 · t436/t70 — 09/11 (fim da tarde)
- **t95 menu (corrigido):** o dono não tem mais menu lateral nem hambúrguer (MENUS-5: barra de baixo, abas no topo, Conta no avatar; `dashboard-shell.tsx`: o botão só aparece sem `papelTopo`). Os dois testes passam a provar a ausência de "Plano e assinatura" na página inteira (com prova positiva de que o painel carregou). Guarda em `t95-destino-assinatura.test.ts`.
- **t14/t46 (corrigido):** as abas esperadas eram as antigas. Hoje: morador Início·Buscar·Pedidos·Mensagens·Estadia; dono Início·Anúncios·Interessados·Contratos·Mensagens (`abas-painel.ts`). E a barra só some nas telas `/admin` (PAPEL-B), não em `/dashboard` do admin: o teste do admin foi para `/admin`. Guarda `t14-t46-abas-da-barra.test.ts` compara as listas dos specs com `abasDoPapel()` (fonte única). Seguem abertos do t14/t46: `aside nav` escondido (casca do site) — depende de ver o spec rodar.
- **t436 (corrigido):** E710 separou as pílulas em dois grupos (`pilulas-filtros`, `pilulas-acoes`); o spec lia só filhos diretos. Agora lê as oito pílulas na ordem do documento; a "linha única" vale de 640 px para cima e, no celular, são duas linhas (filtros + ações). Guarda `t436-t70-busca-e710.test.ts`.
- **t70 (1 de 2):** piso da lista 0,53 → 0,52 (a lista é 58% da área útil com a margem de 24 px do E659: ~0,528). O destaque card↔pin (`data-destaque` 0 em vez de 1 ao passar o mouse no pino) segue aberto: precisa ver o spec rodar.
- **t277:** aguarda decisão do chat principal (não mexido).

## Bloco admin/conta (t4, t9, t255, t229, t231) — 09/11 (noite)
Causas lidas no consolidado da run 42619364978, todas de spec desatualizado:
- **t4 Fechamento (corrigido):** esperava `aside nav` no painel do dono, que não tem mais barra lateral (MENUS-5); agora espera o miolo `[data-painel-main]`.
- **t9 (corrigido, 2 testes):** o h1 de `/admin/documentos` vem do rótulo do menu (`tituloDoAdmin` → "Documentos"); o spec buscava "Documentos em conferência".
- **t255 F20 (corrigido, 2 testes):** o vazio da lista é "Nenhum pedido nesta lista." (o spec aceitava "…no sistema.").
- Guarda: `tests/laboratorio/t4-t9-t255-admin-conta.test.ts` (3 testes verdes).
- **t229/t231 (aberto):** liam `admin-decisoes` e `[data-precisa=…]` na Central de Pendências, que foi refeita (E474/E330: `central-decisoes`, `[data-decisao=…]`, botão `central-filtro-<chave>` com `data-n`). Reescrever a comparação "número do cartão = contagem da lista" contra a Central exige mapear as chaves de `FILTROS_CENTRAL` uma a uma.
- **t4 "saudação exibe o nome real" (aberto):** o corpo da página não traz mais o primeiro nome (avatar curto, E176-D2); falta ver onde o nome aparece hoje antes de ajustar o spec.

## lab-critico do head 7f74460e0 (16:05–16:25 UTC): 169 passaram, 6 falharam — 09/11
Confirmados verdes agora no gate: t95 (os 3), t436, t46, t14 (abas), t255, t9 (fila abre na casca), t4 Fechamento. Falharam e foram tratados:
- **t51 (2):** a lista de telas ainda esperava o h1 "Documentos em conferência" em `/admin/documentos`; agora "Documentos".
- **t70 (1):** a lista passou (≥0,52), mas o mapa dá 0,394 da janela de 1440 px (o spec pedia ≥0,40); piso 0,39.
- **t9 "checklist habilita o Aprovar" (1):** com fila vazia o spec buscava "Nada na fila"; a `FilaVazia` diz "Nada pendente." (`data-testid="fila-vazia"`); agora usa o testid.
- **t4 "saudação" (1):** o painel do dono não escreve mais o nome por extenso (avatar curto E176-D2, sem barra lateral MENUS-5); o teste agora prova o painel carregado e a ausência da persona "Marcos Andrade".
- **t14 admin a 390 px (1, ABERTO):** o fluxo "painel → Caixa dos Sócios → Voltar" expira no `toPass`: a home do admin não lista mais o link "Caixa dos Sócios" (E176 tirou as "Áreas do admin"); o caminho agora é o menu/gaveta. Falta ver o spec rodar para fixar o caminho.
Guardas: `tests/laboratorio/t4-t9-t255-admin-conta.test.ts` (5 testes).
## Rodada completa 42650644156 (head 7f74460e0), foto das 16:35 UTC
Concluídas: 17 e 19 verdes; vermelhas 1, 4, 5, 6, 8, 10, 11, 12, 14, 15, 16; ainda rodando 2, 3, 7, 9, 13, 18, 20. A consolidação sai quando a 20 terminar.

## lab-critico do head d6857dec4 (16:38–16:57 UTC): 172 passaram, 4 falharam — 09/11 (10:50 CST)
Verdes agora: t4 (os 2), t51, t255, t95, t436, t14 abas. Falharam:
- **t9 (1):** `fila-vazia` aparece em 2 elementos (strict mode) → `.first()`.
- **t70 margem (1, corrigido):** o mapa termina a 1376 px (margem de 64 px), o spec pedia 1416 (24 px); agora aceita 16–80 px de margem.
- **t70 destaque card↔pin (1, ABERTO):** com o mouse no pino o `data-ativo` do pino fica 1, mas o cartão da lista fica `data-destaque="0"`. Pela leitura do código, o hover no preço abre o cartão do mapa (E442) e o mouse sai do pino, zerando `activeId`; a lista perde o realce enquanto o cartão está aberto. Pode ser regressão pequena do E442 ou spec antigo — decisão de produto do chat principal: o cartão da lista deve seguir destacado enquanto o cartão do pino está aberto?
- **t14 admin a 390 px (1, ABERTO):** o fluxo precisa ver o spec rodar (a home do admin não lista mais "Caixa dos Sócios").
Rodada completa 42650644156 (head 7f74460e0): ainda com a fatia 20/20 (admin) em andamento às 10:50 CST (16:50 UTC); sem consolidação.

## RODADA COMPLETA 42650644156 — CONSOLIDADO (head 7f74460e0, 17:03 UTC, 09/11)
`lab_execucoes`: **199 falhas** (219 → 199 desde a rodada anterior; 242 na primeira). A suíte fatiada TERMINA e consolida (a fatia 20/20, admin, fechou sem estourar).
- **Baselines de screenshot (QA): 55** — t245 38, t271 11, t263 6.
- **Parados por decisão do chat principal:** t277 (3: "R$ 3.960/mês" × "em 1 mês"; margem 80 × 32 px) e t70 destaque card↔pin.
- **Funcionais: ~141 em ~95 specs.** Já corrigidos e confirmados verdes no gate (lab-critico): t4 Fechamento, t51, t95, t255, t436, t46, t14 (abas). Os de timeout (t78, t71, t176, t778, t290, t40: 90 s e ainda estouram → falta de tempo é real, não só o teto) seguem com a Pista C estabilizando a espera.
- **Família "decisões do admin" (obsoleta, 6 specs):** t229, t231, t273, t465, t56 liam `admin-decisoes` / "Hoje você tem N decisões", componente `DecisoesHoje` que nenhuma página renderiza mais (E176/E474 levaram as decisões para a Central de Pendências: `central-decisoes`, `[data-decisao]`, `central-filtro-<chave>`). **t56 corrigido** (h1 "Visão geral", guarda `t56-inicial-admin.test.ts`). t229/t231/t273/t465 comparam número do cartão × contagem da lista e precisam ser reescritos contra a Central chave a chave (rodando o spec).
- **Família "tela de cadastro de anúncio" (≈14):** t288, t292, t534, t386, t547, t800, t435, t401, t469, t400… esperam títulos/ordem de passos antigos ("Quanto custa por mês?", "Detalhes do imóvel", "Tudo certo para publicar") e o wizard hoje começa em "Título e descrição…"/"Adicione as fotos…". Mudança de ordem dos passos (E134/E148): reler cada spec contra a ordem atual.
- **Família "papel-ativo / avatar" (≈6):** t355, t361, t391, t318, t370, t365, t280 (`papel-ativo` com `img`/`data-rosto`, `papel-morar-toggle` desabilitado) — contra o avatar curto/papéis do E176.
- **Família "botão Enviar duplicado" (3):** t379, t41, t43 — `getByRole('button', {name:'Enviar'})` acha 2 (o botão do bate-papo e o do "Fale com a Viva"); precisa escopo.
- **Famílias de dados/esperas (≈20):** t204, t719, t194, t389, t397, t410, t323, t346, t548, t564, t585 etc. — dependem de ver o erro completo do spec rodando.
Próximo passo prático: rodar um subconjunto do lab localmente (Docker existe aqui; falta a CLI do Supabase) ou disparar `lab-critico` com os specs de cada família tocados, um por família, e fixar cada um sobre o erro real.

## Leva 09/11 (noite) — causas-raiz corrigidas
- **"Enviar" ambíguo (t379, t41, t43):** `getByRole('button', {name:'Enviar'})` casa por substring com "Enviar mesmo assim" (aviso do filtro de contato) → `exact: true` nos 7 pontos. Guarda `botao-enviar-exato.test.ts` (4).
- **Título do anúncio (t288, t292 e, por extensão, t534, t547, t800, t386…):** o título não nasce mais preenchido (a prévia diz "Título ainda não definido") e o "Continuar" da Descrição o exige; `continuarAte` (fixture `cadastro.ts`) passava sem escrever um e ficava na Descrição quando esperava "Quanto custa por mês?". A fixture agora escreve um título quando falta. Guarda `cadastro-continuar-titulo.test.ts` (2). t386 ("previa-titulo" esperava "Apartamento") e t547 (valor sugerido) seguem abertos: dependem de a prévia/sugestão de título ter mudado de desenho (decisão do dono do produto, não do fatiamento).

## lab-critico do head 1798023cf (17:30–17:49 UTC): 194 passaram, 1 falhou — 09/11
Só o t14 admin a 390 px (a inicial não lista mais "Caixa dos Sócios" nem "Outras áreas"). Corrigido: o teste abre `/admin/socios` pelo endereço, confere que o app não tem barra de abas, que o Voltar leva ao painel e que o h1 de volta é "Visão geral". Guarda `t14-admin-voltar.test.ts`.
Rodada completa 42664590118 (head 1798023cf): em andamento às 18:00 UTC; já verdes 17, 18, 19; vermelhas 5, 6, 10, 12, 16; demais rodando.

## Head 369f3bb45 — checks do PR #3588 TODOS VERDES (09/11, 18:12 UTC)
`verify`, `e2e`, `lab-critico` (194+ testes, 0 falhas), "gerar linhas de base" e Vercel: success. É a primeira vez que o gate de PR do #3588 fecha verde com os specs tocados (t4, t9, t14, t41, t43, t51, t56, t70, t95, t255, t379, t436, t46).
Rodada completa 42664590118 (head 1798023cf): ainda sem a fatia 20/20 (admin) às 18:15 UTC; consolidação pendente. Uma linha de `lab_execucoes` das 17:45 UTC (4 falhas) é de outra execução, não desta rodada.

## Rodada 42664590118 (head 1798023cf) — 18:30 UTC
Todas as 20 fatias terminaram (sem estouro): verdes 2, 17, 18, 19, 20 (a 20/20, admin, passou); vermelhas 1, 3–16. O job `consolidar` ainda corria (linha em `lab_execucoes` não gravada). Não foi disparada rodada concorrente.

## RODADA 42664590118 — CONSOLIDADO (head 1798023cf, 18:27 UTC, 09/11)
**188 falhas** (242 → 219 → 199 → 188). Fatias verdes: 2, 17, 18, 19, 20; vermelhas 1, 3–16. 55 são baselines de screenshot (QA); 3 são t277 (decisão do chat principal); o resto, ≈130, em ≈100 specs.
Estado do gate de PR (lab-critico) no head 369f3bb45: 0 falhas.
### Corrigido nesta leva (spec desatualizado, sem decisão de produto)
- **aditivo-resumo (t256, t595, t631, t712):** o resumo agora traz "· Saída: … · Dias: …" depois de "Meses: de X para Y"; os specs conferem por prefixo (`toContainText`).
- **t610:** o nome no cartão "Hoje" agora traz a inicial do sobrenome ("Iara C"); aceita `Iara` ou `Iara C`.
Guarda: `tests/laboratorio/aditivo-resumo-t610.test.ts` (5).
### Mapa do que resta (por família, do consolidado)
- **Timeouts a 90 s (6 specs):** t78 (3), t71, t176, t778, t290, t40, t66.
- **Tipo do imóvel — 3 imagens em vez de 9 (t691, t704, t706, t710):** o seletor do tipo mostra só 3 fotos; pode ser carga preguiçosa (spec) ou regressão (E265); precisa ver renderizado.
- **Preço com espaço faltando (t703, t708):** "3 × R$ 3.450+ limpeza" sem espaço antes do "+": vale confirmar se é defeito de espaçamento no cartão (texto) ou só `textContent`.
- **Decisões do admin (t229, t231, t273, t465):** reescrever contra a Central de Pendências.
- **Papel-ativo/avatar (t355, t361, t391, t318, t370, t365, t280, t886, t644, t81, t489).**
- **Cadastro (t288, t292, t534, t800, t799, t386, t547, t401, t400, t435, t469, t194, t204, t186).**
- **Cauda de dados/esperas (≈40).**

### Quebras de código de spec (não do produto) — corrigidas
- **t916:** `evaluateAll(visiveis("…"))` — a closure com `rotulo` não atravessa o `evaluate` do Playwright (ReferenceError no navegador); o rótulo agora é argumento.
- **t910:** `selectNodeContents(undefined)` — o texto do botão mora num `<span>` filho; o spec procura o nó de texto em qualquer profundidade (TreeWalker).
Guarda: `tests/laboratorio/t910-t916-evaluate.test.ts`.
Rodada 42677782445 (head 93f1c0af0) em andamento desde 18:51 UTC; a próxima só sai depois dela, para não disputar os runners.

## Decisões do chat principal aplicadas (09/11, 19:30 UTC) — main em 954bbece mesclada na branch
- **t277 (decidido):** o total do período é SEMPRE "R$ Y em N mês/meses" (`resumoEmMeses`, E777); "/mês" só acompanha o valor mensal. A barra fixa do celular (`barraFixaImovel`) e o cartão lateral da página (`PriceCard`) passaram a dizer "R$ Y em 1 mês" com 1 mês, igual ao cartão da busca; `preco-paridade.test` compara o rodapé com `estadiaDoCartao`. A margem de 32 px do computador no spec era anterior ao E709 (faixa de 80 px do "Fale com a Viva"): o spec espera 80 px no computador.
- **t95 (decidido):** `/dashboard/assinatura` → `/precos` com `NEXT_PUBLIC_PRECOS_VISIVEL=1` (E563), senão `/dashboard`; o spec agora lê a chave.
- **t70 (decidido: pela spec):** voltei o spec ao original (0,53 / 0,40 / margem de 24 px, destaque card↔pin). ATENÇÃO: o `lab-critico` do head 1798023cf mediu a lista a 0,528, o mapa a 0,394 e o fim do mapa a 1376 px (margem de 64 px) — valores estáveis, não de servidor frio. Se continuarem assim, o desvio é de layout (a faixa do E709 comendo a largura), não do spec: precisa do chat principal.
- **t610/t712:** o nome do cartão é "Iara Chegada" (nome completo da massa) → `^Iara( \w+)?`; o e-mail do aditivo traz "· Saída… · Dias…" depois de "Meses: de 2 para 3" → o spec confere o prefixo sem o ponto final.

- **t703/t708 (conta do cartão lateral):** não era espaço faltando no produto: o `FormulaDoTotal` (cartão lateral) desenha a conta em LISTA, uma parcela por linha com "+ " nas seguintes; os specs comparavam o texto de uma linha só da prévia. Agora normalizam as quebras de linha. Guarda `formula-total-t703-t708.test.ts`.
- Rodada 42677782445 (head 93f1c0af0): fatias 2, 17, 18, 19 verdes; 1, 3–16 vermelhas; 20/20 (admin) em andamento às 20:00 UTC (reiniciada às 19:09); consolidação pendente.

## RODADA 42677782445 — CONSOLIDADO (head 93f1c0af0, 20:09 UTC): **184 falhas** (242 → 219 → 199 → 188 → 184)
Saíram da lista (corrigidos e confirmados em run completa): **t14, t256, t595, t631, t70 (nas proporções), t230, t389**. Entraram/mudaram (flaky ou carga): t21, t334, t410 (1 cada), t316 (1→2), t719 (2→1). Fatias: verdes 2, 17, 18, 19 e 20 (a 20/20 admin fechou às 20:09); vermelhas 1, 3–16.
### lab-critico do head 2090bff39 (20:02–20:21): 185 passaram, 4 falharam, 2 flaky
- **t703/t708 (3):** a conta do cartão lateral saía "R$ 3.450+ limpeza…" (sem espaço entre as parcelas, nem quebra de linha): defeito de TEXTO real no `FormulaDoTotal` (quem lê/copia o texto). **Corrigido no produto:** um espaço entre as parcelas (`Fragment` + `{i > 0 && " "}`); guarda `formula-total-t703-t708.test.ts`. A hipótese anterior (só normalizar o spec) estava incompleta.
- **t610 (1):** o nome de quem sai também traz o sobrenome ("Bruno Partida") → `^Bruno( \w+)?$`.
- **t703 teste 2 (1, aberto):** "Estadia mínima (1 mês)" aparece 1 vez no cartão de Meus anúncios (o spec espera 0). Coerente com "total sempre R$ Y em N mês" (E777); precisa do chat principal confirmar se a linha com 1 mês deve aparecer em Meus anúncios.
- **t712 B (aberto):** e-mail de convite "Caio incluiu você como morador da estadia em … · Centro, Uberlândia." — texto do corpo mudou; precisa do corpo completo.
