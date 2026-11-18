/*
  Roda: node --test tests/laboratorio/e744-t2-quarentena.test.ts
  E744, T2 (plano de 17/11): a quarentena formal dos testes instáveis.

  - tests/laboratorio/quarentena.json tem uma entrada por teste: spec, titulo, motivo, item (o item de instabilidade),
    dono, entrada e expira (no máximo 14 dias depois da entrada). Teto: 25 entradas.
  - As fatias bloqueantes rodam SEM esses testes (--grep-invert gerado do arquivo).
  - Um job que não bloqueia roda só eles, com 1 worker e 3 repetições, e publica o resultado.
  - O consolidar mostra o tamanho da quarentena, as vencidas e as que passaram 3 de 3 (candidatas a sair).
  Esta guarda falha se o arquivo passar do teto, se uma entrada não tiver item, dono ou validade, ou se alguma estiver vencida.
  A parte "vencida" usa a data de hoje: no dia em que uma entrada vence, o `npm test` fica vermelho até alguém decidir.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  TETO,
  VALIDADE_MAXIMA_DIAS,
  lerQuarentena,
  padraoDaQuarentena,
  resultadoDaQuarentena,
  textoDaQuarentena,
  validarQuarentena,
  vencidas,
} from "../../scripts/lab/quarentena.mjs";

type Entrada = { spec: string; titulo: string; motivo: string; item: string; dono: string; entrada: string; expira: string };
const ok = (extra: Partial<Entrada> = {}): Entrada => ({
  spec: "t29-chat-sem-aprovacao.spec.ts",
  titulo: "'Ok, tudo aprovado' para o Moacir: não aprova nada e não cria ordem",
  motivo: "instável em 7 de 7 corridas",
  item: "E1011",
  dono: "Code 2",
  entrada: "2026-11-17",
  expira: "2026-12-01",
  ...extra,
});
const HOJE = "2026-11-17";

// ---------- validação estática ----------

test("entrada completa e dentro da validade passa", () => {
  assert.deepEqual(validarQuarentena([ok()], HOJE), []);
  assert.deepEqual(validarQuarentena([], HOJE), []);
});

test("teto: 25 entradas passam, a 26ª reprova", () => {
  assert.equal(TETO, 25);
  const n = (k: number) => Array.from({ length: k }, (_, i) => ok({ titulo: `teste ${i}`, item: `E${2000 + i}` }));
  assert.deepEqual(validarQuarentena(n(25), HOJE), []);
  assert.match(validarQuarentena(n(26), HOJE).join("\n"), /26 entradas.*teto.*25/);
});

test("campos: sem item, sem dono ou sem validade reprova, e diz qual entrada", () => {
  for (const campo of ["spec", "titulo", "motivo", "item", "dono", "entrada", "expira"] as const) {
    const erros = validarQuarentena([ok({ [campo]: "" })], HOJE).join("\n");
    assert.match(erros, new RegExp(`sem ${campo}`), campo);
    assert.match(erros, /t29-chat-sem-aprovacao|entrada 1/, campo);
  }
  assert.match(validarQuarentena([ok({ item: "instável" })], HOJE).join("\n"), /item "instável" não é E<número>/);
  assert.match(validarQuarentena([ok({ expira: "01/12/2026" })], HOJE).join("\n"), /data "01\/12\/2026"/);
  assert.match(validarQuarentena([ok({ spec: "t29-chat" })], HOJE).join("\n"), /spec "t29-chat" não termina em \.spec\.ts/);
});

test("validade: no máximo 14 dias depois da entrada, e nunca antes dela", () => {
  assert.equal(VALIDADE_MAXIMA_DIAS, 14);
  assert.deepEqual(validarQuarentena([ok({ entrada: "2026-11-17", expira: "2026-12-01" })], HOJE), []);
  assert.match(validarQuarentena([ok({ entrada: "2026-11-17", expira: "2026-12-02" })], HOJE).join("\n"), /15 dias.*máximo.*14/);
  assert.match(validarQuarentena([ok({ entrada: "2026-11-17", expira: "2026-11-16" })], HOJE).join("\n"), /expira antes da entrada/);
});

test("vencida: vale até o dia da validade, inclusive; no dia seguinte reprova", () => {
  const e = ok({ entrada: "2026-11-17", expira: "2026-12-01" });
  assert.deepEqual(validarQuarentena([e], "2026-12-01"), []);
  assert.match(validarQuarentena([e], "2026-12-02").join("\n"), /vencida em 2026-12-01/);
  assert.deepEqual(vencidas([e], "2026-12-01"), []);
  assert.deepEqual(vencidas([e], "2026-12-02"), [e]);
});

test("o mesmo teste não entra duas vezes", () => {
  assert.match(validarQuarentena([ok(), ok({ item: "E1012" })], HOJE).join("\n"), /repetida/);
});

test("spec que não existe reprova quando a conferência do arquivo é pedida", () => {
  const erros = validarQuarentena([ok({ spec: "t99999-nao-existe.spec.ts" })], HOJE, { specExiste: (s: string) => existsSync(`tests/e2e/specs/${s}`) });
  assert.match(erros.join("\n"), /t99999-nao-existe\.spec\.ts não existe/);
});

// ---------- o --grep-invert ----------

/** Como o Playwright monta o texto que o --grep lê: projeto, arquivo, describes, título e etiquetas, separados por espaço. */
const noGrep = (spec: string, describes: string[], titulo: string, etiquetas: string[] = []) => ["", "chromium", spec, ...describes, titulo, ...etiquetas].join(" ");
/** O Playwright faz new RegExp(padrão, "gi") com o texto da linha de comando. */
const casa = (padrao: string, texto: string) => new RegExp(padrao, "gi").test(texto);

test("sem entradas não há padrão (o workflow não passa --grep-invert)", () => {
  assert.equal(padraoDaQuarentena([]), "");
});

test("o padrão casa o teste da entrada, com e sem describe, com e sem etiqueta", () => {
  const p = padraoDaQuarentena([ok()]);
  const titulo = ok().titulo;
  assert.ok(casa(p, noGrep("t29-chat-sem-aprovacao.spec.ts", ["T29 — chat"], titulo)));
  assert.ok(casa(p, noGrep("t29-chat-sem-aprovacao.spec.ts", [], titulo)));
  assert.ok(casa(p, noGrep("t29-chat-sem-aprovacao.spec.ts", ["T29 — chat @criticos"], titulo, ["@sensivel-carga"])));
});

test("o padrão NÃO casa outro teste do mesmo spec, nem o mesmo título em outro spec, nem título que só começa igual", () => {
  const p = padraoDaQuarentena([ok({ titulo: "uma aba acesa, a da seção visível (390)", spec: "t776-e340-menu-parceiro-secao.spec.ts" })]);
  const spec = "t776-e340-menu-parceiro-secao.spec.ts";
  assert.ok(casa(p, noGrep(spec, ["T776"], "uma aba acesa, a da seção visível (390)")));
  assert.ok(!casa(p, noGrep(spec, ["T776"], "uma aba acesa, a da seção visível (1280)")));
  assert.ok(!casa(p, noGrep("t777-outro.spec.ts", ["T777"], "uma aba acesa, a da seção visível (390)")));
  assert.ok(!casa(p, noGrep(spec, ["T776"], "uma aba acesa, a da seção visível (390) e mais")));
  // Limite conhecido: o Playwright junta describes e título com espaço, então um título do MESMO spec que termine com o
  // título inteiro de uma entrada (depois de um espaço) também casaria. Nenhum spec da quarentena tem esse caso.
  // O ponto de ".spec.ts" e os parênteses do título são texto, não regra de busca.
  assert.ok(!casa(p, noGrep("t776-e340-menu-parceiro-secaoXspecXts", ["T776"], "uma aba acesa, a da seção visível (390)")));
});

test("várias entradas viram um padrão só, e cada uma segue separada da outra", () => {
  const a = ok();
  const b = ok({ spec: "t190-seo-robots-jsonld.spec.ts", titulo: "anúncio real: Offer com Accommodation, estadia mín/máx e sem coordenada", item: "E1015" });
  const p = padraoDaQuarentena([a, b]);
  assert.ok(casa(p, noGrep(a.spec, ["x"], a.titulo)));
  assert.ok(casa(p, noGrep(b.spec, ["y"], b.titulo)));
  assert.ok(!casa(p, noGrep(a.spec, ["x"], b.titulo)), "o título de uma no spec da outra não casa");
  assert.ok(!casa(p, noGrep("t1-home.spec.ts", [], "a home abre")));
});

test("o padrão não muda com a ordem das chaves e é o mesmo para as fatias (invertido) e para o job da quarentena", () => {
  const a = ok();
  assert.equal(padraoDaQuarentena([a]), padraoDaQuarentena([{ ...a }]));
  assert.doesNotMatch(padraoDaQuarentena([a]), /^\/.*\/[gi]*$/, "não pode parecer /regex/flags: o Playwright trocaria as opções");
});

// ---------- o resultado do job da quarentena ----------

/** Relatório JSON do Playwright com um teste repetido (--repeat-each 3): cada repetição é um teste com o mesmo título. */
const relatorio = (spec: string, titulo: string, estados: string[]) => ({
  suites: [{ title: spec, file: spec, specs: estados.map((status) => ({ title: titulo, file: spec, tests: [{ projectName: "chromium", expectedStatus: "passed", status, results: [{ status: status === "expected" ? "passed" : "failed" }] }] })) }],
});

test("3 de 3: candidata a sair; 2 de 3: fica; não rodou: aparece como não rodou", () => {
  const a = ok();
  const b = ok({ spec: "t190-seo-robots-jsonld.spec.ts", titulo: "anúncio real", item: "E1015" });
  const c = ok({ spec: "t305-laudo-avaliacao-62b2.spec.ts", titulo: "3. reprovado", item: "E1016" });
  const junto = { suites: [...relatorio(a.spec, a.titulo, ["expected", "expected", "expected"]).suites, ...relatorio(b.spec, b.titulo, ["expected", "unexpected", "expected"]).suites] };
  const r = resultadoDaQuarentena([a, b, c], junto, HOJE);
  assert.equal(r.tamanho, 3);
  assert.deepEqual(r.linhas.map((l: { item: string; passou: number; rodou: number }) => [l.item, l.passou, l.rodou]), [["E1011", 3, 3], ["E1015", 2, 3], ["E1016", 0, 0]]);
  assert.deepEqual(r.candidatas.map((l: { item: string }) => l.item), ["E1011"]);
  assert.deepEqual(r.vencidas, []);
});

test("instável (passou só na nova tentativa) não conta como passou", () => {
  const a = ok();
  const r = resultadoDaQuarentena([a], relatorio(a.spec, a.titulo, ["expected", "flaky", "expected"]), HOJE);
  assert.deepEqual([r.linhas[0].passou, r.linhas[0].rodou], [2, 3]);
  assert.deepEqual(r.candidatas, []);
});

test("o resumo diz o tamanho, as vencidas e as candidatas a sair, e nunca esconde uma entrada", () => {
  const a = ok();
  const b = ok({ spec: "t190-seo-robots-jsonld.spec.ts", titulo: "anúncio real", item: "E1015", entrada: "2026-11-01", expira: "2026-11-15" });
  const junto = { suites: [...relatorio(a.spec, a.titulo, ["expected", "expected", "expected"]).suites, ...relatorio(b.spec, b.titulo, ["unexpected", "unexpected", "unexpected"]).suites] };
  const texto = textoDaQuarentena(resultadoDaQuarentena([a, b], junto, HOJE));
  assert.match(texto, /### Quarentena/);
  assert.match(texto, /2 de 25/);
  assert.match(texto, /Vencidas: 1/);
  assert.match(texto, /Passaram 3 de 3 \(candidatas a sair\): 1/);
  assert.match(texto, /\| E1011 \|.*\| 3 de 3 \|/);
  assert.match(texto, /\| E1015 \|.*\| 0 de 3 \|.*vencida/);
  // Quarentena vazia também aparece, com zero.
  assert.match(textoDaQuarentena(resultadoDaQuarentena([], { suites: [] }, HOJE)), /0 de 25/);
});

// ---------- o arquivo de verdade e o workflow ----------

// ---------- entrada de spec inteira (decisão do Gerente, ORDEM-DUET-097, 18/11) ----------
// Quando os casos que falham dependem dos casos anteriores do mesmo spec, uma entrada só cobre o spec inteiro: as fatias
// gerais ficam sem ele e o job da quarentena roda o arquivo com a cadeia de dependências intacta. A entrada diz quais
// casos falham; não leva `titulo`.
const inteira = (extra: Record<string, unknown> = {}) => {
  const { titulo: _titulo, ...resto } = ok({ spec: "t442-foto-perfil-revisao.spec.ts", item: "E13" });
  return { ...resto, specInteira: true, casos: ["4. denúncia", "5. Remover"], ...extra };
};

test("spec inteira: a entrada vale sem titulo, com os casos que falham", () => {
  assert.deepEqual(validarQuarentena([inteira()], HOJE), []);
  assert.match(validarQuarentena([inteira({ casos: [] })], HOJE).join("\n"), /spec inteira sem os casos que falham/);
  assert.match(validarQuarentena([inteira({ casos: undefined })], HOJE).join("\n"), /spec inteira sem os casos que falham/);
  assert.match(validarQuarentena([inteira({ titulo: "4. denúncia" })], HOJE).join("\n"), /spec inteira não leva titulo/);
  // Os outros campos continuam obrigatórios.
  assert.match(validarQuarentena([inteira({ dono: "" })], HOJE).join("\n"), /sem dono/);
  // `casos` só existe na entrada de spec inteira.
  assert.match(validarQuarentena([{ ...ok(), casos: ["x"] }], HOJE).join("\n"), /casos só vale em entrada de spec inteira/);
});

test("spec inteira: o spec não entra duas vezes, nem inteiro e por teste ao mesmo tempo", () => {
  assert.match(validarQuarentena([inteira(), inteira()], HOJE).join("\n"), /entrada repetida/);
  const porTeste = ok({ spec: "t442-foto-perfil-revisao.spec.ts", titulo: "4. denúncia", item: "E13" });
  assert.match(validarQuarentena([inteira(), porTeste], HOJE).join("\n"), /o spec já está inteiro na quarentena/);
  assert.match(validarQuarentena([porTeste, inteira()], HOJE).join("\n"), /o spec já está inteiro na quarentena/);
});

test("spec inteira: o padrão casa todos os testes do spec e nenhum de outro", () => {
  const p = padraoDaQuarentena([inteira(), ok()]);
  const spec = "t442-foto-perfil-revisao.spec.ts";
  for (const titulo of ["1. foto nova entra", "3. fila", "4. denúncia pela página do proprietário", "5. Remover com motivo"]) assert.ok(casa(p, noGrep(spec, ["T442 — FOTO-PERFIL-B"], titulo)), titulo);
  assert.ok(casa(p, noGrep(spec, [], "teste sem describe")));
  assert.ok(!casa(p, noGrep("t443-outro.spec.ts", ["T443"], "4. denúncia pela página do proprietário")));
  assert.ok(!casa(p, noGrep("xt442-foto-perfil-revisao.spec.ts", ["T442"], "1. foto nova entra")), "nome de arquivo que só termina igual não casa");
  // A outra entrada, por teste, segue como era.
  assert.ok(casa(p, noGrep(ok().spec, ["T29"], ok().titulo)));
  assert.ok(!casa(p, noGrep(ok().spec, ["T29"], "outro teste do t29")));
});

test("spec inteira: o resumo conta todas as repetições de todos os casos; só é candidata a sair se todos passarem", () => {
  const e = inteira();
  const rel = (estados: string[][]) => ({ suites: ["1. foto", "4. denúncia", "5. Remover"].flatMap((t, i) => relatorio(e.spec, t, estados[i]).suites) });
  const bom = resultadoDaQuarentena([e], rel([["expected", "expected", "expected"], ["expected", "expected", "expected"], ["expected", "expected", "expected"]]), HOJE);
  assert.deepEqual([bom.linhas[0].passou, bom.linhas[0].rodou], [9, 9]);
  assert.deepEqual(bom.candidatas.map((l: { item: string }) => l.item), ["E13"]);
  const ruim = resultadoDaQuarentena([e], rel([["expected", "expected", "expected"], ["expected", "unexpected", "expected"], ["expected", "skipped", "expected"]]), HOJE);
  assert.deepEqual([ruim.linhas[0].passou, ruim.linhas[0].rodou], [7, 8]);
  assert.deepEqual(ruim.candidatas, []);
  // A linha do resumo diz que é o spec inteiro e quais casos falham.
  assert.match(textoDaQuarentena(bom), /t442-foto-perfil-revisao\.spec\.ts › \(spec inteira; falham: 4\. denúncia; 5\. Remover\) \| 9 de 9/);
});

test("o arquivo da quarentena é válido HOJE: teto, campos, validade, nenhuma vencida, specs existem", () => {
  const entradas = lerQuarentena();
  const hoje = new Date().toISOString().slice(0, 10);
  const erros = validarQuarentena(entradas, hoje, { specExiste: (s: string) => existsSync(`tests/e2e/specs/${s}`) });
  assert.deepEqual(erros, []);
  for (const e of entradas as (Entrada & { specInteira?: boolean; casos?: string[] })[]) {
    // O título tem que estar escrito no spec. Quando o spec monta o título (largura, nome do agente, nome da tela), a
    // parte fixa fica no começo ou no fim: confere os primeiros ou os últimos 24 caracteres. As aspas escapadas do
    // código (\") contam como aspas.
    const fonte = readFileSync(`tests/e2e/specs/${e.spec}`, "utf8").replaceAll('\\"', '"');
    // Entrada de spec inteira (ORDEM-DUET-097): não tem título; a mesma conferência vale para cada caso que ela nomeia.
    for (const titulo of e.specInteira === true ? e.casos! : [e.titulo]) {
      assert.ok(fonte.includes(titulo.slice(0, 24)) || fonte.includes(titulo.slice(-24)), `${e.spec}: o título "${titulo}" não está no spec`);
    }
  }
});

// Asserção alterada (E13, ORDEM-DUET-102): o t442 entrou como spec inteira (ORDEM-DUET-097) porque os casos 4 e 5 dependiam
// dos casos 1 a 3. A correção do E13 tira a dependência e o tira da quarentena. A guarda passa a cobrar a saída e o que a
// sustenta: os casos 4 e 5 num bloco próprio que não pula (mode "default"), com estado semeado; os casos 1 a 3 seguem em série.
test("o t442 saiu da quarentena com a correção do E13: os casos 4 e 5 não dependem dos casos 1 a 3 (ORDEM-DUET-102)", () => {
  const dele = (lerQuarentena() as { spec: string }[]).filter((e) => e.spec === "t442-foto-perfil-revisao.spec.ts");
  assert.equal(dele.length, 0, "o t442 não está mais na quarentena");
  const fonte = readFileSync("tests/e2e/specs/t442-foto-perfil-revisao.spec.ts", "utf8");
  const blocoB = fonte.slice(fonte.indexOf('test.describe("denúncia e remoção'));
  const blocoA = fonte.slice(0, fonte.indexOf('test.describe("denúncia e remoção'));
  assert.match(blocoA, /mode: "serial"/, "os casos 1 a 3 seguem em série");
  assert.match(blocoB, /mode: "default"/, "o bloco dos casos 4 e 5 não pula o 5 quando o 4 falha");
  assert.doesNotMatch(blocoB, /mode: "serial"/);
  assert.match(blocoB, /semearFotoAprovada\(/, "o caso 4 tem a foto aprovada sem depender do caso 3");
  assert.match(blocoB, /garantirDenunciada\(/, "o caso 5 tem a denúncia sem depender do caso 4");
  assert.match(blocoB, /test\("4\. denúncia/);
  assert.match(blocoB, /test\("5\. Remover/);
});

test("regra de entrada: toda entrada tem disposição na lista da T1 — instável com o mesmo item, teste velho apontando a correção, ou defeito sem marca com o item dele", () => {
  // Asserção alterada por decisão do Gerente (DUET-1225, 17/11): além do instável com item, entra o teste velho que já
  // tem correção escrita em PR aberto, por no máximo 14 dias e apontando o PR. Sai quando a correção for mesclada: a
  // quarentena não fica mascarando a correção.
  // Alterada de novo por decisão do Gerente (DUET-1419, 17/11): o defeito registrado, com item e dono, entra quando a
  // falha não é sempre a mesma (por isso está sem a marca de falha conhecida). Sai no PR da correção do item. O defeito
  // que leva a marca continua de fora (a marca já o trata), e o já corrigido também.
  const disposicoes = (JSON.parse(readFileSync("tests/laboratorio/disposicao-falhas.json", "utf8")).disposicoes ?? []) as { spec: string; disposicao: string; item?: string; dono?: string; pr?: number; semMarca?: string; corrigidoPor?: string }[];
  for (const e of lerQuarentena() as (Entrada & { correcao?: number })[]) {
    const d = disposicoes.find((x) => x.spec === e.spec);
    assert.ok(d, `${e.spec}: em quarentena sem disposição`);
    assert.equal(d!.dono, e.dono, `${e.spec}: dono diferente do da disposição`);
    if (d!.disposicao === "instavel") {
      assert.equal(d!.item, e.item, `${e.spec}: item diferente do da disposição`);
      // Alterada por decisão do Gerente (DUET-1849, 18/11): o instável cuja correção já está escrita em PR aberto aponta
      // esse PR (o mesmo da disposição); sem PR, continua sem apontar.
      if (e.correcao !== undefined) assert.equal(e.correcao, d!.pr, `${e.spec}: a correção apontada não é a da disposição`);
    } else if (d!.disposicao === "defeito") {
      assert.equal(d!.item, e.item, `${e.spec}: item diferente do da disposição`);
      assert.ok((d!.semMarca ?? "").length > 20, `${e.spec}: defeito com a marca de falha conhecida não entra na quarentena`);
      assert.equal(d!.corrigidoPor, undefined, `${e.spec}: defeito já corrigido não entra na quarentena`);
      if (e.correcao !== undefined) assert.equal(e.correcao, d!.pr, `${e.spec}: a correção apontada não é a da disposição`);
    } else {
      assert.equal(d!.disposicao, "teste-velho", `${e.spec}: classe "${d!.disposicao}" não entra na quarentena`);
      assert.ok(Number.isInteger(e.correcao), `${e.spec}: teste velho em quarentena sem o PR da correção`);
      assert.equal(e.correcao, d!.pr, `${e.spec}: a correção apontada não é a da disposição`);
    }
  }
});

test("correcao: quando existe, é o número do PR; texto ou zero reprova", () => {
  assert.deepEqual(validarQuarentena([{ ...ok(), correcao: 3934 }], HOJE), []);
  assert.match(validarQuarentena([{ ...ok(), correcao: "#3934" }], HOJE).join("\n"), /correcao "#3934" não é o número do PR/);
  assert.match(validarQuarentena([{ ...ok(), correcao: 0 }], HOJE).join("\n"), /correcao "0" não é o número do PR/);
});

test("cadeiaDe: a entrada de cadeia aponta uma entrada raiz do mesmo spec, com o mesmo item, que não é ela mesma de cadeia", () => {
  const raiz = ok({ titulo: "1. cria" });
  assert.deepEqual(validarQuarentena([raiz, { ...ok({ titulo: "2. usa" }), cadeiaDe: "1. cria" }], HOJE), []);
  assert.match(validarQuarentena([raiz, { ...ok({ titulo: "2. usa" }), cadeiaDe: "1. não existe" }], HOJE).join("\n"), /cadeiaDe "1\. não existe" não é uma entrada do mesmo spec/);
  assert.match(validarQuarentena([raiz, { ...ok({ titulo: "2. usa", item: "E9999" }), cadeiaDe: "1. cria" }], HOJE).join("\n"), /item diferente do da entrada raiz/);
  assert.match(validarQuarentena([{ ...raiz, cadeiaDe: "2. usa" }, { ...ok({ titulo: "2. usa" }), cadeiaDe: "1. cria" }], HOJE).join("\n"), /a entrada raiz também é de cadeia/);
});

test("cadeia em série: quando os testes seguintes dependem do que está em quarentena, a cadeia entra inteira", () => {
  // Caso real (17/11, prova local do PR das disposições): só o caso 1 do t230 e do t321 em quarentena deixou as fatias
  // gerais vermelhas — o caso 3 do t230 espera a Caução que o caso 1 registra, e o caso 2 do t321 espera o vídeo que o
  // caso 1 envia. A entrada de cadeia existe para isso: tira das fatias, junto com a raiz, os testes que dependem dela.
  const entradas = lerQuarentena() as (Entrada & { cadeiaDe?: string })[];
  const deCadeia = entradas.filter((e) => e.cadeiaDe);
  for (const spec of new Set(deCadeia.map((e) => e.spec))) {
    const fonte = readFileSync(`tests/e2e/specs/${spec}`, "utf8").replaceAll('\\"', '"');
    assert.match(fonte, /mode: "serial"/, `${spec}: entrada de cadeia em spec que não roda em série`);
    const titulos = [...fonte.matchAll(/^\s+test\("(.*)", async /gm)].map((m) => m[1]);
    const raizes = new Set(deCadeia.filter((e) => e.spec === spec).map((e) => e.cadeiaDe!));
    assert.equal(raizes.size, 1, `${spec}: uma raiz por cadeia`);
    const [raiz] = [...raizes];
    const aPartirDaRaiz = titulos.slice(titulos.indexOf(raiz));
    assert.ok(titulos.includes(raiz), `${spec}: a raiz "${raiz}" não está no spec`);
    // A cadeia inteira a partir da raiz: nenhum teste seguinte fica nas fatias gerais sem o que ele precisa.
    assert.deepEqual(entradas.filter((e) => e.spec === spec).map((e) => e.titulo), aPartirDaRaiz, `${spec}: a cadeia não entrou inteira`);
  }
  // Nenhuma cadeia segue em quarentena: a do t321 (E1022) saiu com a correção do E1022 e a do t230 (E1020) com a do E1020.
  assert.deepEqual([...new Set(deCadeia.map((e) => `${e.spec.split("-")[0]} ${e.item}`))].sort(), []);
});

test("o workflow: as fatias excluem a quarentena, uma entrada própria roda só ela e não bloqueia, e o consolidar publica o resumo", () => {
  const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
  const fatia = yml.slice(yml.indexOf("\n  laboratorio:"), yml.indexOf("\n  construir:"));
  const consolidar = yml.slice(yml.indexOf("\n  consolidar:"));
  // 1) fatias gerais e da varredura: o padrão sai do script e entra como --grep-invert (só quando há entradas).
  assert.match(fatia, /QUARENTENA="\$\(node scripts\/lab\/quarentena\.mjs padrao\)"/);
  assert.match(fatia, /\[ -n "\$QUARENTENA" \] && FORA=\(--grep-invert "\$QUARENTENA"\)/);
  // T3 (plano de 17/11): as gerais excluem também os etiquetados @sensivel-carga, no mesmo --grep-invert (GERAL).
  assert.match(fatia, /GERAL=\(--grep-invert "@sensivel-carga\$\{QUARENTENA:\+\|\$QUARENTENA\}"\)/);
  assert.match(fatia, /LAB_PESADOS=fora npx playwright test --shard=\$\{\{ matrix\.fatia \}\}\/20 "\$\{GERAL\[@\]\}"/);
  // A fatia da varredura que ficar sem teste (o dela foi para a quarentena) não reprova por "nenhum teste".
  assert.match(fatia, /npx playwright test t48-varredura --grep "\$GREP" "\$\{FORA\[@\]\}" --pass-with-no-tests/);
  // 2) a entrada "quarentena" da matriz: só os testes do arquivo, 1 worker, 3 repetições, sem nova tentativa.
  assert.match(fatia, /include:\n\s+- fatia: quarentena\n/);
  assert.match(fatia, /npx playwright test --grep "\$QUARENTENA" --workers=1 --repeat-each=3 --retries=0 /);
  assert.doesNotMatch(/npx playwright test --grep "\$QUARENTENA"[^\n]*/.exec(fatia)![0], /LAB_PESADOS|--shard|grep-invert/);
  // ... não bloqueia: nem por teste que falha, nem por preparo que quebra; e não passa de 20 jobs ao mesmo tempo.
  assert.match(fatia, /continue-on-error: \$\{\{ matrix\.fatia == 'quarentena' \}\}/);
  assert.match(fatia, /if: \$\{\{ steps\.e2e\.outcome == 'failure' && github\.event_name != 'pull_request' && matrix\.fatia != 'quarentena' \}\}\n\s+run: exit 1/);
  assert.match(fatia, /max-parallel: 20\n/);
  // ... e o resultado dela não se mistura com o das fatias: outro nome de artifact, fora do padrão "fatia-*".
  assert.match(fatia, /if: \$\{\{ !cancelled\(\) && matrix\.fatia != 'quarentena' \}\}\n\s+uses: actions\/upload-artifact@v4\n\s+with:\n\s+name: laboratorio-\$\{\{ github\.run_id \}\}-fatia-\$\{\{ matrix\.fatia \}\}/);
  assert.match(fatia, /if: \$\{\{ !cancelled\(\) && matrix\.fatia == 'quarentena' \}\}\n\s+uses: actions\/upload-artifact@v4\n\s+with:\n\s+name: laboratorio-\$\{\{ github\.run_id \}\}-quarentena\n/);
  assert.match(consolidar, /pattern: laboratorio-\$\{\{ github\.run_id \}\}-fatia-\*/);
  // T3: 25 fatias que bloqueiam (20 gerais, 4 da varredura, 1 dos sensíveis à carga); a quarentena segue fora da conta.
  assert.match(consolidar, /--esperadas 25/, "a quarentena não conta como fatia");
  // 3) o consolidar: baixa o resultado da quarentena (sem derrubar se faltar), escreve o resumo e acusa erro do arquivo.
  assert.match(consolidar, /continue-on-error: true\n\s+uses: actions\/download-artifact@v4\n\s+with:\n\s+name: laboratorio-\$\{\{ github\.run_id \}\}-quarentena/);
  assert.match(consolidar, /node scripts\/lab\/quarentena\.mjs resumo "\$\{QUARENTENA_JSON:-quarentena\/resultado\.json\}" --saida tests\/laboratorio\/saida\/quarentena\.json/);
  assert.match(consolidar, /node scripts\/lab\/quarentena\.mjs validar/);
  // 4) a rodada continua vermelha por fatia, completude e regressão — a quarentena não entra nessa conta.
  assert.match(consolidar, /needs\.laboratorio\.result != 'success'/);
});

test("completude: a listagem do commit também sai sem a quarentena, para listados e executados falarem do mesmo conjunto", () => {
  const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
  const construir = yml.slice(yml.indexOf("\n  construir:"), yml.indexOf("\n  consolidar:"));
  assert.match(construir, /QUARENTENA="\$\(node scripts\/lab\/quarentena\.mjs padrao\)"/);
  assert.match(construir, /npx playwright test --list --reporter=json "\$\{FORA\[@\]\}" > lista\.json/);
});
