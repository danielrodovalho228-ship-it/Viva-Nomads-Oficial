import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FOTOS_FERRAMENTAS } from "./capas.ts";

// Prompt 42, item 2: as telas logadas abrem com título em texto — sem a faixa de foto (capa) que ocupava um quarto da
// tela sem informação. As páginas públicas seguem com as fotos delas.
test("Prompt 42: PageTitle não desenha capa fotográfica e nenhuma tela logada passa capa", () => {
  const prim = readFileSync(new URL("./primitives.tsx", import.meta.url), "utf8");
  const titulo = prim.slice(prim.indexOf("export function PageTitle"), prim.indexOf("export function StatCard"));
  assert.doesNotMatch(titulo, /capa|<Image|painel-capa/);
  assert.doesNotMatch(prim, /from "next\/image"/);
  const andar = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? andar(p) : p.endsWith(".tsx") ? [p] : [];
    });
  const logadas = [...andar("src/app/(dashboard)"), ...andar("src/components/dashboard"), ...andar("src/components/account")];
  for (const f of logadas) assert.doesNotMatch(readFileSync(f, "utf8"), /<PageTitle[^>]*\bcapa=|DashboardBanner|data-testid="painel-capa"/, f);
  assert.equal(existsSync(new URL("./banner.tsx", import.meta.url)), false, "a faixa de boas-vindas com foto saiu");
});

test("as fotos dos grupos de Ferramentas continuam apontando para arquivos que existem", () => {
  for (const f of Object.values(FOTOS_FERRAMENTAS)) assert.ok(existsSync(`public${f.src}`), f.src);
});

test("D6: spec t59 confere que o botão flutuante não cobre o último card no painel a 390 px", () => {
  const spec = readFileSync(new URL("../../../tests/e2e/specs/t59-flutuante-nao-tampa.spec.ts", import.meta.url), "utf8");
  assert.match(spec, /último card/);
  assert.match(spec, /b36ca0ee/);
});
