import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolverPeriodo } from "./visao-geral.ts";

const pagina = readFileSync(new URL("../../app/(dashboard)/admin/funil/page.tsx", import.meta.url), "utf8");

test("E337 — sem período na URL, o Funil abre os indicadores em 7 dias (a mesma janela do funil da semana)", () => {
  assert.match(pagina, /resolverPeriodo\(\{ periodo: um\("periodo"\) \?\? "7"/);
  assert.equal(resolverPeriodo({ periodo: "7" }, "2026-11-01").dias, 7);
  // As outras telas que usam o resolvedor seguem com 30 dias por padrão.
  assert.equal(resolverPeriodo({}, "2026-11-01").dias, 30);
});

test("E337 — cada seção diz a própria janela; janela diferente ganha aviso", () => {
  assert.match(pagina, /titulo="Funil da semana" janela=\{janelaSemana\}/);
  assert.match(pagina, /titulo="Indicadores do período"/);
  assert.match(pagina, /"Janela diferente do funil da semana acima: não compare os números das duas seções\."/);
  assert.match(pagina, /"Mesma janela do funil da semana\."/);
  assert.doesNotMatch(pagina, /subtitle=\{`Últimos 7 dias/);
});
