import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsx(p) : n.endsWith(".tsx") ? [p] : [];
  });
}

test("varredura 01/11: o Logo (que já é link) nunca vai dentro de outro <Link>/<a> — <a> dentro de <a> quebra a hidratação", () => {
  const achados = tsx(raiz).filter((f) => /<(Link|a)\b[^>]*>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<Logo(?![^>]*href=\{null\})/.test(readFileSync(f, "utf8")));
  assert.deepEqual(achados, []);
});

test("varredura 01/11: o topo do painel leva ao Início do painel pelo próprio Logo, com nome que contém o texto visível", () => {
  const topo = readFileSync(join(raiz, "components/layout/topo-dono.tsx"), "utf8");
  assert.match(topo, /<Logo href="\/dashboard" rotulo="VivaNomads — início do painel" className="shrink-0" \/>/);
  const logo = readFileSync(join(raiz, "components/ui/logo.tsx"), "utf8");
  assert.match(logo, /rotulo = "VivaNomads — página inicial"/);
  assert.match(logo, /aria-label=\{rotulo\} data-logo/);
});
