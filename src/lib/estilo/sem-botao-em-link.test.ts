import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsx(p) : n.endsWith(".tsx") && !n.includes(".test.") ? [p] : [];
  });
}

// Varredura 01/11 (achado 7): <Link><Button>…</Button></Link> põe um <button> dentro de um <a> — HTML inválido, dois
// alvos de foco no Tab e o leitor de tela anuncia os dois. O caminho do site é ButtonLink (um <a> com cara de botão).
test("nenhum <Button> dentro de <Link> (use ButtonLink)", () => {
  const achados = tsx(raiz).filter((f) => /<Link\b[^>]*>\s*<Button\b/.test(readFileSync(f, "utf8")));
  assert.deepEqual(achados, []);
});
