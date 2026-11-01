/*
  Achado 32 (frente erros/estados vazios): /admin/candidaturas não pode mostrar "Nenhuma candidatura nesta lista"
  quando a leitura falha. As duas listas leem com `exigir`; o erro cai no error.tsx do admin ("Tentar de novo").
  Roda: node --test src/lib/admin/achado32-candidaturas-exigir.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("as duas funções aceitam exigir e lançam no erro", () => {
  const s = ler("../data/admin-indicadores.ts");
  const periodo = s.slice(s.indexOf("export async function candidaturasDoPeriodo"), s.indexOf("export async function candidaturasSemResposta48h"));
  assert.match(periodo, /opcoes: \{ exigir\?: boolean \} = \{\}/);
  assert.match(periodo, /if \(error && opcoes\.exigir\) throw/);
  const sem = s.slice(s.indexOf("export async function candidaturasSemResposta48h"));
  assert.match(sem.slice(0, 1200), /opcoes: \{ exigir\?: boolean \} = \{\}/);
  assert.match(sem.slice(0, 1200), /if \(error && opcoes\.exigir\) throw/);
});

test("a página pede exigir nas duas listas", () => {
  const p = ler("../../app/(dashboard)/admin/candidaturas/page.tsx");
  assert.match(p, /candidaturasSemResposta48h\(admin, \{ exigir: true \}\)/);
  assert.match(p, /candidaturasDoPeriodo\(admin, intervaloBRT\(p\.inicio, p\.fim\), cidade, \{ exigir: true \}\)/);
});
