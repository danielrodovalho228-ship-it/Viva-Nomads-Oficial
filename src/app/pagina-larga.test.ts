import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Regra do Daniel (13/10): a área logada ocupa a largura cheia do conteúdo.
// Nenhuma página/cliente de src/app/(dashboard) pode ter wrapper "mx-auto max-w-*".
// Wrapper de página: <div|main|section> com "mx-auto" e um "max-w-*" de página (lg ou maior), em
// qualquer ordem. Texto centralizado curto (<p>, max-w-md/sm/xs de estado vazio) não é wrapper.
const LARGURA = String.raw`max-w-(?:lg|xl|[2-7]xl|screen\S*|prose)\b`;
const WRAPPER_ESTREITO = new RegExp(
  String.raw`<(?:div|main|section)\b[^>]*?(?:\bmx-auto\b[^>]*?${LARGURA}|${LARGURA}[^>]*?\bmx-auto\b)`,
);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

test("área logada não tem wrapper estreito centralizado", () => {
  const ruins = arquivos(join(process.cwd(), "src/app/(dashboard)")).filter((f) =>
    WRAPPER_ESTREITO.test(readFileSync(f, "utf8")),
  );
  assert.deepEqual(ruins, []);
});

test("o regex pega as duas ordens das classes (mx-auto max-w e max-w mx-auto)", () => {
  assert.ok(WRAPPER_ESTREITO.test('<div className="mx-auto max-w-3xl p-4">'));
  assert.ok(WRAPPER_ESTREITO.test('<div className="max-w-3xl mx-auto p-4">'));
  assert.ok(WRAPPER_ESTREITO.test('<main className="w-full max-w-2xl px-4 mx-auto">'));
  assert.ok(!WRAPPER_ESTREITO.test('<p className="mx-auto mt-2 max-w-md text-muted">'));
  assert.ok(!WRAPPER_ESTREITO.test('<div className="max-w-xs truncate">'));
});
