/*
  E292 / E292-bis — "a Viva só conecta" (diretriz do Daniel de 31/10, correção validada pelo coordenador no relay 32):
  a Viva não calcula imposto com regra própria. O simulador PF × PJ saiu do painel do dono (/dashboard/tributacao) e
  da memória interna dos sócios (/tributario): as duas rotas redirecionam para Ferramentas, e nenhum código de tela
  importa mais `src/lib/tax.ts`. As regras puras e o portão do aviso de IBS/CBS continuam testados enquanto existirem.
  Roda: node --test src/lib/e292-numeros-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AVISO_IBS_CBS_LIBERADO, PJ_ACCOUNTING_YEAR, simulateTax } from "./tax.ts";

const RAIZ = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

test("E292-bis: /dashboard/tributacao e /tributario redirecionam (permanente) para /dashboard/ferramentas", () => {
  for (const f of ["src/app/(dashboard)/dashboard/tributacao/page.tsx", "src/app/tributario/page.tsx"]) {
    const t = ler(f);
    assert.match(t, /permanentRedirect\("\/dashboard\/ferramentas"\)/, f);
    assert.doesNotMatch(t, /TaxSimulator|simulateTax|lib\/tax|tributario"/, f);
  }
  assert.equal(existsSync(join(RAIZ, "src/components/tax-simulator.tsx")), false);
  assert.equal(existsSync(join(RAIZ, "src/lib/tributario.ts")), false);
});

test("E292-bis: nenhum código do app importa src/lib/tax.ts", () => {
  const importam = arquivos(join(RAIZ, "src")).filter((f) => /from ["'](@\/lib\/tax|\.\/tax\.ts|\.\.\/tax\.ts|\.\/tax)["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(importam.map((f) => f.slice(RAIZ.length)), []);
});

test("E292-bis: menu, hub de Ferramentas e páginas internas sem a tributação", () => {
  assert.doesNotMatch(ler("src/config/menu-por-papel.ts").replace(/\/\/[^\n]*/g, ""), /tributacao|PF × PJ/);
  assert.doesNotMatch(ler("src/app/(dashboard)/dashboard/ferramentas/page.tsx").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""), /tributacao|tributario|PF × PJ/);
  assert.doesNotMatch(ler("src/components/apresentacao/paginas-nav.tsx"), /\/tributario/);
});

test("regras puras (enquanto o módulo existir): o custo de manter a empresa é o informado; sem ele, a referência", () => {
  const base = { monthlyRent: 8000, propertyCount: 2 };
  assert.equal(simulateTax({ ...base, pjAnnualCost: 3600 }).pjAnnualCost, 3600);
  assert.equal(simulateTax({ ...base, pjAnnualCost: 0 }).pjAnnualCost, 0);
  assert.equal(simulateTax(base).pjAnnualCost, PJ_ACCOUNTING_YEAR);
  assert.equal(simulateTax({ monthlyRent: 0, propertyCount: 0, pjAnnualCost: 3600 }).pjAnnualCost, 0);
});

test("portão do parecer: o aviso de IBS/CBS continua desligado", () => {
  assert.equal(AVISO_IBS_CBS_LIBERADO, false);
});
