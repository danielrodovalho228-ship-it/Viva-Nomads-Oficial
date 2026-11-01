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

// E247 (resíduo, varredura 01/11): nenhum seletor de arquivo nativo VISÍVEL ("Choose File / No file chosen" em inglês).
// Todo <input type="file"> fica escondido (sr-only/hidden) atrás do botão do site (SeletorArquivo ou o equivalente local).
test("nenhum input de arquivo nativo visível no src", () => {
  const visiveis: string[] = [];
  for (const f of tsx(raiz)) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/<input\b[^>]*?type="file"[\s\S]*?\/>/g)) {
      if (!/sr-only|className="hidden"|"hidden\b|\bhidden"|className=\{cn\([^)]*hidden/.test(m[0])) visiveis.push(f.replace(raiz, ""));
    }
  }
  assert.deepEqual(visiveis, []);
});

test("SeletorArquivo: botão em português, nome do arquivo ao lado, campo nativo sr-only e acessível", () => {
  const c = readFileSync(join(raiz, "components/ui/seletor-arquivo.tsx"), "utf8");
  assert.match(c, /rotulo = "Escolher arquivo"/);
  assert.match(c, /"Nenhum arquivo escolhido"/);
  assert.match(c, /aria-label=\{ariaLabel \?\? rotulo\}\s+className="sr-only"/);
});
