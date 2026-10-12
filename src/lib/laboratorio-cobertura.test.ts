import test from "node:test";
import assert from "node:assert/strict";
import { descobrir, lerMapa, percentual, caminhoDe, personaDe } from "../../scripts/lab/cobertura.mjs";

const mapa: { tipo: string; id: string; personas: string[] }[] = lerMapa().itens;
const chaves = new Set(mapa.map((e) => `${e.tipo}|${e.id}`));

test("cobertura: toda página, rota de API e Server Action tem entrada no mapa", () => {
  const faltando = descobrir().filter((i) => !chaves.has(`${i.tipo}|${i.id}`)).map((i) => `${i.tipo} ${i.id}`);
  assert.deepEqual(faltando, [], `Sem entrada em tests/e2e/cobertura.json (rode: node scripts/lab/cobertura.mjs --gravar):\n${faltando.join("\n")}`);
});

test("cobertura: o mapa não guarda entrada de arquivo que não existe mais", () => {
  const reais = new Set(descobrir().map((i) => `${i.tipo}|${i.id}`));
  const orfas = mapa.filter((e) => !reais.has(`${e.tipo}|${e.id}`)).map((e) => `${e.tipo} ${e.id}`);
  assert.deepEqual(orfas, []);
});

test("cobertura: toda entrada tem ao menos uma persona válida", () => {
  const validas = new Set(["público", "inquilino", "proprietário", "parceiro", "admin", "sócio"]);
  for (const e of mapa) assert.ok(e.personas.length > 0 && e.personas.every((p) => validas.has(p)), e.id);
});

test("cobertura: ao menos 74 páginas e 46 rotas de API mapeadas", () => {
  assert.ok(mapa.filter((e) => e.tipo === "pagina").length >= 74);
  assert.ok(mapa.filter((e) => e.tipo === "api").length >= 46);
});

test("cobertura: caminho e persona (grupos de rota somem; admin só admin)", () => {
  assert.equal(caminhoDe("/x/src/app/(public)/parceiros/page.tsx", "page").endsWith("/parceiros"), true);
  assert.deepEqual(personaDe("/admin/pedidos", "pagina"), ["admin"]);
  assert.deepEqual(personaDe("/buscar", "pagina"), ["público"]);
});

test("cobertura: percentual conta só entradas com spec", () => {
  const r = percentual([{ tipo: "pagina", spec: "t1" }, { tipo: "pagina", spec: null }]);
  assert.equal(r.percentual, 50);
  assert.equal(r.por_tipo.pagina.cobertos, 1);
});
