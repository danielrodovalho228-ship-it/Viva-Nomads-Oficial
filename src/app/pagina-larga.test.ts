import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Regra do Daniel (13/10): a área logada ocupa a largura cheia do conteúdo.
// Nenhuma página/cliente de src/app/(dashboard) pode ter wrapper "mx-auto max-w-*".
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

test("área logada não tem wrapper estreito centralizado", () => {
  const ruins = arquivos(join(process.cwd(), "src/app/(dashboard)")).filter((f) =>
    /mx-auto\s+max-w-/.test(readFileSync(f, "utf8")),
  );
  assert.deepEqual(ruins, []);
});
