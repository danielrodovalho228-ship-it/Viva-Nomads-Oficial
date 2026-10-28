import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abasDoPapelPainel } from "../../src/config/abas-painel.ts";

// A t262 ficou velha quando o MENUS-5 (#1392) trocou as abas (Perfil saiu, entraram Pedidos/Interessados/Contratos) e
// o chip "papel-ativo" deu lugar ao avatar da Conta. As listas da spec agora saem de constantes; este teste as confere
// com a fonte única (config/abas-painel.ts), para a spec não envelhecer em silêncio de novo.
const spec = readFileSync("tests/e2e/specs/t262-detalhe-imovel-41.spec.ts", "utf8");

function lista(nome: string): string[] {
  const m = spec.match(new RegExp(`const ${nome} = (\\[[^\\]]*\\]);`));
  assert.ok(m, `a t262 declara ${nome}`);
  return JSON.parse(m[1]) as string[];
}
const nomes = (papel: "morador" | "proprietario" | "parceiro", comContrato = false) => abasDoPapelPainel(papel, { comContrato }).map((a) => a.rotulo);

test("t262: as abas esperadas por papel são as da fonte única", () => {
  assert.deepEqual(lista("NOMES_MORADOR"), nomes("morador"));
  assert.deepEqual(lista("NOMES_PROPRIETARIO"), nomes("proprietario"));
  assert.deepEqual(lista("NOMES_PARCEIRO"), nomes("parceiro"));
});

test("t262 + E176 (D1): a 'Estadia' do morador aparece com ou sem contrato", () => {
  assert.deepEqual(nomes("morador", true), lista("NOMES_MORADOR"));
  assert.deepEqual(nomes("morador", false), lista("NOMES_MORADOR"));
  assert.match(spec, /nome: "Estadia", href: "\/dashboard\/locacoes"/);
});

test("t262: nada da barra antiga (Perfil na barra, 'Estadias', Ganhos do dono) nem o chip papel-ativo", () => {
  assert.doesNotMatch(spec, /papel-ativo/);
  assert.doesNotMatch(spec, /"Estadias"/);
  assert.doesNotMatch(spec, /nome: "Perfil"/);
});

test("t262: o avatar da Conta que a spec procura existe no shell por papel", () => {
  const topo = readFileSync("src/components/layout/topo-dono.tsx", "utf8");
  assert.match(topo, /`conta-\$\{p\.px\}-celular`/);
  for (const id of ["conta-morador-celular", "conta-dono-celular", "conta-parceiro-celular"]) assert.ok(spec.includes(id), id);
});
