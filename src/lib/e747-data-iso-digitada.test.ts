// E747: no campo de data do Passo 9, '2026-11-15' digitado tecla a tecla virava '20/26/1115'. A máscara agora reconhece o ano na
// frente (4 dígitos + "-") e segue em ISO até completar; nunca embaralha. Sem "-", a máscara dd/mm/aaaa de sempre.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brParaIso, mascararData, mascararDataDigitada } from "./data-digitada.ts";

/** Simula a digitação tecla a tecla: cada tecla é acrescentada ao texto que o campo mostra. */
function digitar(teclas: string): string[] {
  let texto = "";
  const passos: string[] = [];
  for (const t of teclas) {
    texto = mascararDataDigitada(texto + t);
    passos.push(texto);
  }
  return passos;
}

test("E747: '2026-11-15' digitado tecla a tecla chega em 15/11/2026, sem passar por '20/26/1115'", () => {
  const passos = digitar("2026-11-15");
  assert.equal(passos.at(-1), "15/11/2026");
  // (o "20/26" de quando só há 4 dígitos, antes do "-", é inevitável; o que não pode é o resultado embaralhado)
  for (const p of passos) assert.doesNotMatch(p, /^20\/26\/\d/, `passo ${p}`);
  assert.equal(brParaIso(passos.at(-1)!), "2026-11-15");
});

test("E747: no meio do caminho o texto fica em ISO legível (2026-, 2026-1, 2026-11-, 2026-11-1)", () => {
  const p = digitar("2026-11-1");
  for (const esperado of ["2026-", "2026-1", "2026-11-", "2026-11-1"]) assert.ok(p.includes(esperado), `falta ${esperado} em ${p.join(" | ")}`);
  assert.equal(p.at(-1), "2026-11-1");
});

test("E747: a data brasileira continua igual (dd/mm/aaaa, com ou sem barras)", () => {
  assert.equal(mascararDataDigitada("15112026"), "15/11/2026");
  assert.equal(mascararDataDigitada("15/11/2026"), "15/11/2026");
  assert.equal(mascararDataDigitada("1511"), mascararData("1511"));
  assert.deepEqual(digitar("15112026").at(-1), "15/11/2026");
});

test("E747: ISO com data que não existe não é embaralhada (fica como digitada, e o campo avisa 'inválida')", () => {
  const f = digitar("2026-02-31").at(-1)!;
  assert.equal(f, "2026-02-31");
  assert.equal(brParaIso(f), null);
});

test("E747: o campo de data usa a máscara nova", () => {
  const c = readFileSync("src/components/ui/campo-data.tsx", "utf8");
  assert.match(c, /mascararDataDigitada\(bruto\)/);
  assert.doesNotMatch(c, /mascararData\(bruto\)/);
});
