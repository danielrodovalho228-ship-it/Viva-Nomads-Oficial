import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Entrada = { personas: string[]; specs: string[] };
type Mapa = { paginas: Record<string, Entrada>; rotas: Record<string, Entrada>; actions: Record<string, Entrada> };
type Gerador = {
  listarPaginas(): string[];
  listarRotas(): string[];
  listarActions(): string[];
  diferencas(reais: string[], mapa: Record<string, Entrada>): { faltando: string[]; sobrando: string[] };
  percentual(mapa: Mapa): number;
  resumoPorTipo(mapa: Mapa): { total: number; cobertos: number; percentual: number; por_tipo: Record<string, { total: number; cobertos: number }> };
};

const RAIZ = process.cwd();
const caminhoGerador = join(RAIZ, "scripts/lab/gerar-cobertura.mjs");
const mapa: Mapa = JSON.parse(readFileSync(join(RAIZ, "tests/e2e/cobertura.json"), "utf8"));
const carregar = (): Promise<Gerador> => import(caminhoGerador);

const AJUDA = "Rode: node scripts/lab/gerar-cobertura.mjs (e preencha persona/spec da entrada nova)";

test("toda página tem entrada no mapa de cobertura", async () => {
  const g = await carregar();
  const d = g.diferencas(g.listarPaginas(), mapa.paginas);
  assert.deepEqual(d, { faltando: [], sobrando: [] }, AJUDA);
});

test("toda rota de API tem entrada no mapa de cobertura", async () => {
  const g = await carregar();
  const d = g.diferencas(g.listarRotas(), mapa.rotas);
  assert.deepEqual(d, { faltando: [], sobrando: [] }, AJUDA);
});

test("toda Server Action tem entrada no mapa de cobertura", async () => {
  const g = await carregar();
  const d = g.diferencas(g.listarActions(), mapa.actions);
  assert.deepEqual(d, { faltando: [], sobrando: [] }, AJUDA);
});

test("caso negativo: item novo sem entrada é apontado como faltando", async () => {
  const g = await carregar();
  const d = g.diferencas([...g.listarPaginas(), "/pagina-nova-sem-mapa"], mapa.paginas);
  assert.deepEqual(d.faltando, ["/pagina-nova-sem-mapa"]);
});

test("toda entrada declara ao menos uma persona conhecida", () => {
  const validas = new Set(["publico", "inquilino", "proprietario", "parceiro", "admin", "socio", "sistema"]);
  for (const grupo of [mapa.paginas, mapa.rotas, mapa.actions]) {
    for (const [chave, e] of Object.entries(grupo)) {
      assert.ok(e.personas.length > 0, `${chave} sem persona`);
      for (const p of e.personas) assert.ok(validas.has(p), `${chave}: persona desconhecida "${p}"`);
    }
  }
});

test("todo spec citado no mapa existe em tests/e2e/specs", () => {
  const existentes = new Set(readdirSync(join(RAIZ, "tests/e2e/specs")).map((f) => f.replace(".spec.ts", "")));
  for (const grupo of [mapa.paginas, mapa.rotas, mapa.actions]) {
    for (const [chave, e] of Object.entries(grupo)) {
      for (const s of e.specs) assert.ok(existentes.has(s), `${chave} cita spec inexistente ${s}`);
    }
  }
});

test("percentual de cobertura é calculado sobre o mapa", async () => {
  const g = await carregar();
  const pct = g.percentual(mapa);
  assert.ok(pct >= 0 && pct <= 100);
});

test("resumo por tipo soma páginas, rotas e actions (alimenta lab_execucoes.por_categoria)", async () => {
  const g = await carregar();
  const r = g.resumoPorTipo(mapa);
  assert.deepEqual(Object.keys(r.por_tipo).sort(), ["actions", "paginas", "rotas"]);
  assert.equal(r.total, Object.values(r.por_tipo).reduce((a, t) => a + t.total, 0));
  assert.equal(r.cobertos, Object.values(r.por_tipo).reduce((a, t) => a + t.cobertos, 0));
  assert.equal(r.percentual, g.percentual(mapa));
});

test("caso negativo: mapa vazio dá 0% sem dividir por zero", async () => {
  const g = await carregar();
  assert.equal(g.resumoPorTipo({ paginas: {}, rotas: {}, actions: {} }).percentual, 0);
});
