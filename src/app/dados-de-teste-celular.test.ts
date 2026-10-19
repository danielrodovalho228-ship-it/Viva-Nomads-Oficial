import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// t213 estourava 59–64 px na lateral a 390 px em /admin/dados-de-teste: o <select> com o rótulo longo
// ("[TESTE QA] … — e-mail") dava ao cartão a largura do maior <option>. Selects ocupam só a largura
// do cartão, e o texto longo (e-mail, título, motivo) quebra em vez de empurrar a tela.
const dir = join(process.cwd(), "src/app/(dashboard)/admin/dados-de-teste");
const ler = (n: string) => readFileSync(join(dir, n), "utf8");

test("selects de dados-de-teste não passam da largura do cartão", () => {
  for (const arq of ["nova-jornada.tsx", "semear-carteira.tsx"]) {
    const selects = ler(arq).match(/<select\b[^]*?className="[^"]*"/g) ?? [];
    assert.ok(selects.length > 0, `${arq} sem <select>`);
    for (const s of selects) assert.match(s, /\bw-full\b[^"]*\bmax-w-full\b/, `${arq}: select sem w-full max-w-full`);
  }
});

test("textos longos da jornada e do log quebram linha", () => {
  assert.match(ler("nova-jornada.tsx"), /className="break-words rounded-lg[^"]*"[^>]*data-testid="jornada-ok"/);
  assert.match(ler("page.tsx"), /<li key=\{l\.id\} className="break-words /);
});
