import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Adendo ao prompt 26 (Daniel, 18/10): a Nômade Drive não existe mais — nenhuma menção no código do site.
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(tsx?|mdx?|json|txt|html)$/.test(n) ? [p] : [];
  });
}

test("nenhuma menção a 'Nômade Drive' em src/ e public/ (fora dos testes)", () => {
  const raiz = new URL("../../", import.meta.url).pathname;
  const proprio = new URL(import.meta.url).pathname;
  const achados = [...arquivos(join(raiz, "src")), ...arquivos(join(raiz, "public"))]
    .filter((f) => f !== proprio && !/\.test\.tsx?$/.test(f)) // os testes citam o nome para garantir que ele sumiu
    .filter((f) => /n[ôo]made\s*-?drive/i.test(readFileSync(f, "utf8")));
  assert.deepEqual(achados, []);
});
