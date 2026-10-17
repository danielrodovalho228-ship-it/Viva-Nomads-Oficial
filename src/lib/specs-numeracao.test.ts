import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// Cada spec E2E tem um número tN próprio (achado do Moacir: t107 repetido).
// Famílias antigas com sufixo (t1-a, t1-b…) ficam de fora: só vale a partir do t100.
test("nenhum número de spec E2E (t100+) se repete", () => {
  const dir = join(process.cwd(), "tests", "e2e", "specs");
  const vistos = new Map<string, string>();
  const repetidos: string[] = [];
  for (const nome of readdirSync(dir)) {
    const m = /^t(\d{3,})-/.exec(nome);
    if (!m) continue;
    const anterior = vistos.get(m[1]);
    if (anterior) repetidos.push(`t${m[1]}: ${anterior} e ${nome}`);
    else vistos.set(m[1], nome);
  }
  assert.deepEqual(repetidos, []);
});
