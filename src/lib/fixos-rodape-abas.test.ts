import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ordem af3a27e3 (itens 4 e 6): nenhum fixo de rodapé pode cruzar a barra de abas do celular
 * (mobile-tab-bar.tsx) nem o "Fale com a Viva". A altura da barra mora em --altura-abas (globals.css).
 */
const RAIZ = new URL("../", import.meta.url).pathname;
const css = readFileSync(join(RAIZ, "app/globals.css"), "utf8");

function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return tsx(p);
    return p.endsWith(".tsx") && !p.endsWith(".test.tsx") ? [p] : [];
  });
}

test("item 6: --altura-abas bate com a altura real da barra de abas (min-h-14 = 56 px; ícone 20 px + gap + texto 11 px)", () => {
  const abas = readFileSync(join(RAIZ, "components/layout/mobile-tab-bar.tsx"), "utf8");
  assert.match(css, /--altura-abas:\s*3\.5rem/);
  assert.match(abas, /min-h-14/);
  assert.match(abas, /py-2/);
  assert.match(abas, /h-5 w-5/);
  assert.match(abas, /gap-1/);
  assert.match(abas, /text-\[11px\]/);
});

test("item 4: só a barra de abas usa fixed + bottom-* direto; os demais fixos de rodapé usam classes vn-*", () => {
  const fora: string[] = [];
  for (const arq of tsx(RAIZ)) {
    for (const linha of readFileSync(arq, "utf8").split("\n")) {
      if (!/\bfixed\b/.test(linha) || /inset-0|table-fixed|"fixed"|=== "fixed"/.test(linha)) continue;
      if (/\bbottom-/.test(linha) && !arq.endsWith("mobile-tab-bar.tsx")) fora.push(`${arq}: ${linha.trim()}`);
    }
  }
  assert.deepEqual(fora, []);
});

test("item 4: cada fixo de rodapé (vn-barra-fixa, vn-barra-comparar) parte de --altura-abas no celular", () => {
  for (const classe of ["vn-barra-fixa", "vn-barra-comparar"]) {
    const bloco = css.match(new RegExp(`^\\.${classe}\\s*\\{[^}]*\\}`, "m"))?.[0] ?? "";
    assert.match(bloco, /bottom: calc\(var\(--altura-abas\)/, classe);
    const app = css.match(new RegExp(`html\\[data-app\\] \\.${classe}\\s*\\{[^}]*\\}`))?.[0] ?? "";
    assert.match(app, /var\(--altura-abas\)/, `${classe} no app`);
  }
  assert.doesNotMatch(css, /bottom: calc\(3\.5rem/);
});

test("item 4: o 'Fale com a Viva' parte acima da barra de abas e usa --ajuda-bottom (+ piso quando arrastado)", () => {
  assert.match(css, /--ajuda-bottom:\s*5\.25rem/);
  assert.match(css, /\.vn-viva-flut\s*\{[^}]*var\(--ajuda-bottom, 1\.5rem\)/);
  const viva = readFileSync(join(RAIZ, "components/ajuda/viva-chat.tsx"), "utf8");
  assert.match(viva, /var\(--viva-piso, 0px\)/);
});
