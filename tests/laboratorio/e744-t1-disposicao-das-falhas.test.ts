/*
  Roda: node --test tests/laboratorio/e744-t1-disposicao-das-falhas.test.ts
  E744, T1 (plano de 17/11): cada spec vermelho da última corrida completa tem UMA disposição, escrita em
  tests/laboratorio/disposicao-falhas.json:
    - teste-velho: o teste ficou para trás de uma decisão registrada; aponta o PR (ou o commit) que o corrige;
    - defeito: defeito real do produto, com item registrado; o spec leva defeitoConhecido("E<item>", …), que é o
      test.fail() com a anotação { type: "defeito", description: "E<item>" };
    - instavel: item de instabilidade com dono; é a lista de entrada da quarentena.
  A guarda prende o arquivo ao que está nos specs: defeito sem marca, marca sem disposição e disposição sem dono não passam.
  Nada de test.skip novo nem de mais tentativas: a marca não desliga o teste.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

type Disposicao = { spec: string; disposicao: string; item?: string; dono?: string; pr?: number; corrigidoPor?: string; semMarca?: string; semPr?: string; pacote?: string; nota?: string };
const SPECS = "tests/e2e/specs";
const arquivo = JSON.parse(readFileSync("tests/laboratorio/disposicao-falhas.json", "utf8")) as { corrida: { run: number; base: string; specs: number; casos: number }; disposicoes: Disposicao[] };
const lista = arquivo.disposicoes;
const fonte = (spec: string) => readFileSync(`${SPECS}/${spec}`, "utf8");
/** As chamadas defeitoConhecido("E…", …) de um spec: os itens, na ordem. */
const marcas = (texto: string) => [...texto.matchAll(/defeitoConhecido\(\s*"(E\d+)"/g)].map((m) => m[1]);

test("cada spec tem uma disposição só, de uma das três classes, com dono", () => {
  assert.ok(lista.length > 0);
  const vistos = new Set<string>();
  for (const d of lista) {
    assert.ok(!vistos.has(d.spec), `${d.spec}: duas disposições`);
    vistos.add(d.spec);
    assert.ok(existsSync(`${SPECS}/${d.spec}`), `${d.spec}: o spec não existe`);
    assert.ok(["teste-velho", "defeito", "instavel"].includes(d.disposicao), `${d.spec}: classe "${d.disposicao}"`);
    assert.ok(d.dono === "Fable" || d.dono === "Code 2", `${d.spec}: sem dono`);
    assert.ok(d.nota && d.nota.length > 10, `${d.spec}: sem nota`);
  }
});

test("teste velho aponta o PR ou o commit da correção, ou está no pacote C2-SUITE", () => {
  for (const d of lista.filter((x) => x.disposicao === "teste-velho")) {
    const temCorrecao = Number.isInteger(d.pr) || /^[0-9a-f]{8}$/.test(d.corrigidoPor ?? "");
    assert.ok(temCorrecao || d.pacote === "C2-SUITE", `${d.spec}: teste velho sem PR, commit nem pacote`);
    if (d.dono === "Code 2") assert.equal(d.pacote, "C2-SUITE", `${d.spec}: fora da área da Fable vai para o pacote C2-SUITE`);
    if (d.dono === "Fable") assert.ok(temCorrecao, `${d.spec}: teste velho da Fable sem correção apontada`);
    assert.equal(d.item, undefined, `${d.spec}: teste velho não leva item de defeito`);
  }
});

/** Defeito que leva a marca no spec: o que ainda está na main e falha sempre do mesmo jeito. */
const levaMarca = (d: Disposicao) => d.disposicao === "defeito" && !d.corrigidoPor && !d.semMarca;

test("defeito real: item registrado, PR da correção, e o spec marcado com esse item", () => {
  const defeitos = lista.filter((x) => x.disposicao === "defeito");
  assert.ok(defeitos.length > 0);
  for (const d of defeitos) {
    assert.match(d.item ?? "", /^E\d+$/, `${d.spec}: defeito sem item`);
    // Asserção alterada em 17/11 (DUET-1319: toda falha da corrida de prova tem disposição até 19/11): o defeito achado
    // agora ainda não tem PR de correção. Nesse caso o arquivo diz por quê (semPr); o item continua obrigatório, e a marca também, salvo o motivo escrito (semMarca).
    assert.ok(Number.isInteger(d.pr) || (d.semPr ?? "").length > 20, `${d.spec}: defeito sem o PR da correção e sem o motivo`);
    const texto = fonte(d.spec);
    const itens = marcas(texto);
    if (!levaMarca(d)) {
      // Sem marca só em dois casos, escritos no arquivo: a correção já entrou na main, ou a falha não é sempre a mesma
      // (marcar um teste que às vezes passa deixaria a noite vermelha pelo motivo errado).
      assert.ok(/^[0-9a-f]{8}$/.test(d.corrigidoPor ?? "") || (d.semMarca ?? "").length > 20, `${d.spec}: defeito sem marca e sem o motivo`);
      assert.equal(itens.length, 0, `${d.spec}: defeito sem marca no arquivo, mas marcado no spec`);
      continue;
    }
    assert.ok(itens.length > 0, `${d.spec}: defeito sem defeitoConhecido no spec`);
    assert.deepEqual([...new Set(itens)], [d.item], `${d.spec}: a marca cita outro item`);
    assert.match(texto, /import \{ defeitoConhecido \} from "\.\.\/fixtures\/defeito-conhecido";/, `${d.spec}: sem o import da marca`);
  }
});

test("marca sem disposição não existe: todo spec com defeitoConhecido está no arquivo como defeito", () => {
  const comMarca = readdirSync(SPECS).filter((f) => f.endsWith(".spec.ts") && marcas(fonte(f)).length > 0);
  const noArquivo = lista.filter(levaMarca).map((x) => x.spec);
  assert.deepEqual(comMarca.sort(), [...noArquivo].sort());
});

test("instável: item de instabilidade e dono; o spec não leva marca de defeito", () => {
  const instaveis = lista.filter((x) => x.disposicao === "instavel");
  for (const d of instaveis) {
    assert.match(d.item ?? "", /^E\d+$/, `${d.spec}: instável sem item`);
    assert.equal(marcas(fonte(d.spec)).length, 0, `${d.spec}: instável não é falha conhecida`);
  }
  const itens = instaveis.map((x) => x.item);
  assert.equal(new Set(itens).size, itens.length, "um item de instabilidade por spec");
});

test("a marca é o test.fail() com a anotação do item, e recusa o que não é item", () => {
  const marca = readFileSync("tests/e2e/fixtures/defeito-conhecido.ts", "utf8");
  assert.match(marca, /test\.info\(\)\.annotations\.push\(\{ type: "defeito", description: item \}\)/);
  assert.match(marca, /test\.fail\(true, `\$\{item\}: \$\{motivo\}`\)/);
  assert.match(marca, /if \(!\/\^E\\d\+\$\/\.test\(item\)\) throw/);
  assert.doesNotMatch(marca, /test\.(skip|fixme)\(/);
});

test("a marca não desliga nada: os specs marcados não ganharam pulo, nova tentativa nem .only", () => {
  // Contagem de test.skip / test.fixme de cada spec marcado, como estava na main antes da T1.
  const PULOS_DE_ANTES: Record<string, number> = JSON.parse(readFileSync("tests/laboratorio/disposicao-falhas.json", "utf8")).pulosDosMarcados;
  for (const d of lista.filter(levaMarca)) {
    const texto = fonte(d.spec);
    assert.equal((texto.match(/test\.(skip|fixme)\(/g) ?? []).length, PULOS_DE_ANTES[d.spec], `${d.spec}: o número de pulos mudou`);
    assert.doesNotMatch(texto, /\.only\(|retries:/, `${d.spec}: .only ou retries`);
    assert.doesNotMatch(texto, /(^|[^.\w])test\.fail\(/m, `${d.spec}: use defeitoConhecido, que leva a anotação do item`);
  }
});

test("os números do cabeçalho batem com a lista", () => {
  // A corrida-base tem 82 specs vermelhos; 1 deles (t2131) só existe no ramo do lote que a corrida testou, não na main.
  // A corrida de prova da T3 (run 44114328109) mostrou mais specs que falham em umas corridas e não noutras: entram como
  // acrescentados, cada um com a disposição dele.
  const prova = (arquivo as unknown as { corridaDeProva: { run: number; acrescentados: string[] } }).corridaDeProva;
  assert.equal(prova.run, 44114328109);
  // Asserção alterada por decisão do Gerente (ORDEM-DUET-096, 18/11): antes a conta era só a corrida-base mais a corrida
  // de prova. Entram também os intermitentes achados fora de corrida completa (rodados sozinhos contra a main), cada um
  // com a ordem que o mandou para a lista.
  const fora = (arquivo as unknown as { foraDeCorrida: { ordem: string; data: string; main: string; acrescentados: string[] } }).foraDeCorrida;
  assert.match(fora.ordem, /^ORDEM-DUET-\d+$/);
  assert.match(fora.main, /^[0-9a-f]{8}$/);
  // Asserção alterada, julgada e aprovada pelo Gerente na ORDEM-DUET-191 (19/11; as entradas vêm das ORDEM-DUET-181 e
  // 182): entram também os defeitos já CORRIGIDOS depois da corrida-base, que não cabiam nas outras listas: o spec
  // vermelho de uma corrida manual completa (t296, E1034) e a trava nova de um defeito achado por leitura do código
  // (t1697, E1035). Cada um diz de onde veio.
  const depois = (arquivo as unknown as { corrigidosDepois: { ordem: string; data: string; acrescentados: { spec: string; origem: string }[] } }).corrigidosDepois;
  assert.match(depois.ordem, /^ORDEM-DUET-\d+$/);
  const specsDepois = depois.acrescentados.map((a) => a.spec);
  assert.equal(lista.length, arquivo.corrida.specs - 1 + prova.acrescentados.length + fora.acrescentados.length + specsDepois.length);
  for (const spec of [...prova.acrescentados, ...fora.acrescentados, ...specsDepois]) assert.ok(lista.some((d) => d.spec === spec), `${spec}: acrescentado sem disposição`);
  assert.equal(new Set([...prova.acrescentados, ...fora.acrescentados, ...specsDepois]).size, prova.acrescentados.length + fora.acrescentados.length + specsDepois.length);
  // O que entra por aqui é defeito com a correção já na main: item, PR e o commit do merge (ORDEM-DUET-122).
  for (const a of depois.acrescentados) {
    const d = lista.find((x) => x.spec === a.spec)!;
    assert.equal(d.disposicao, "defeito", `${a.spec}: aqui só entra defeito corrigido`);
    assert.match(d.item ?? "", /^E\d+$/, `${a.spec}: sem item`);
    assert.ok(Number.isInteger(d.pr), `${a.spec}: sem PR`);
    assert.match(d.corrigidoPor ?? "", /^[0-9a-f]{8}$/, `${a.spec}: sem o commit do merge`);
    assert.ok(a.origem.length > 20, `${a.spec}: sem dizer de onde veio`);
  }
  // O que entra por fora de corrida é intermitente: tem item de instabilidade e está na quarentena — até a correção.
  // Asserção alterada por decisão do Gerente (ORDEM-DUET-103, decisão 3, 18/11; julgada na ORDEM-DUET-246): antes, o achado tinha de estar SEMPRE na
  // quarentena, e a guarda reprovava quando a correção tirava a entrada. Agora ele está na quarentena OU tem a correção
  // registrada (corrigidoPor, o commit que corrigiu); nunca as duas coisas, nem nenhuma.
  const emQuarentena = new Set((JSON.parse(readFileSync("tests/laboratorio/quarentena.json", "utf8")).entradas as { spec: string }[]).map((e) => e.spec));
  for (const spec of fora.acrescentados) {
    const d = lista.find((x) => x.spec === spec)!;
    assert.equal(d.disposicao, "instavel", `${spec}: fora de corrida só entra o intermitente`);
    const corrigido = /^[0-9a-f]{8}$/.test(d.corrigidoPor ?? "");
    assert.ok(emQuarentena.has(spec) || corrigido, `${spec}: intermitente fora da quarentena e sem a correção registrada`);
    assert.ok(!(emQuarentena.has(spec) && corrigido), `${spec}: já corrigido e ainda na quarentena`);
  }
  assert.match(arquivo.corrida.base, /^[0-9a-f]{8}$/);
});
