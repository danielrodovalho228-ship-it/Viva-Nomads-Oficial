import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/*
  E166 (Daniel, 25/10): "Só trocar as cores de bege para esta nova que ficou mais clean." O fundo do site é o clean do
  Início do proprietário (surface-2, #f7f7f7) com cartões brancos; o bege/creme ("areia", #f7f2ea, e o creme #fbfaf4)
  não volta. Os tons âmbar de AVISO (amber-50/100) e o dourado de destaque do admin não são fundo de página e ficam.
*/
const RAIZ = new URL("../../", import.meta.url).pathname;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(tsx?|css)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

test("E166 — nenhuma superfície bege/creme: sem o token areia, sem bg-areia e sem #f7f2ea/#fbfaf4", () => {
  const achados: string[] = [];
  for (const f of arquivos(RAIZ)) {
    const s = readFileSync(f, "utf8");
    for (const padrao of [/--color-areia\s*:/, /\bbg-areia\b/, /var\(--color-areia\)/, /#f7f2ea/i, /#fbfaf4/i]) {
      if (padrao.test(s)) achados.push(`${f.replace(RAIZ, "")}: ${padrao}`);
    }
  }
  assert.deepEqual(achados, []);
});

test("E166 — o fundo clean é o do Início do proprietário (surface-2) nas telas que eram bege", () => {
  const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
  assert.match(ler("components/layout/dashboard-shell.tsx"), /flex min-h-screen w-full bg-surface-2/, "a referência: o painel");
  assert.match(ler("components/layout/moldura-assistente.tsx"), /flex min-h-screen w-full flex-col bg-surface-2/, "o assistente de cadastro");
  assert.match(ler("app/globals.css"), /\[data-painel-main\]:has\(\[data-testid="conta-menu"\]\) \{\s*background: var\(--color-surface-2\);/, "as telas da Conta");
  assert.match(ler("lib/auth/porta-visual.ts"), /FUNDO_FORMULARIO_PORTA = "bg-surface-2"/, "a porta de entrar/criar conta");
});
