import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Passada 69: links de ação soltos mediam 17–20 px a 390 e 1280 (abaixo dos 44 px de toque).
const casos: [string, RegExp][] = [
  ["src/app/(dashboard)/dashboard/orcamentos/nova/page.tsx", /<Link href="\/dashboard\/orcamentos" className="[^"]*\bmin-h-11\b[^"]*"/],
  ["src/app/(dashboard)/dashboard/garantias/garantias-client.tsx", /<Link href="\/dashboard\/contratos" className="[^"]*\bmin-h-11\b[^"]*"/],
  ["src/app/(dashboard)/dashboard/propostas/page.tsx", /<Link href="\/dashboard\/candidaturas" className="[^"]*\bmin-h-11\b[^"]*"/],
  ["src/components/account/conta-blocos.tsx", /<Link href=\{i\.acao\.href\} className="[^"]*\bmin-h-11\b[^"]*"/],
];
for (const [arq, re] of casos) {
  test(`alvo de 44 px em ${arq.split("/").slice(-2).join("/")}`, () => {
    assert.match(readFileSync(arq, "utf8"), re);
  });
}
