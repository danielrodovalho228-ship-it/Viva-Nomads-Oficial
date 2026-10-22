import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// O <html> usa scroll-smooth (src/app/layout.tsx): scrollIntoView sem behavior "instant" rola
// aos poucos, e um elementFromPoint logo em seguida vê o alvo fora da tela ("coberto").
// Foi a causa do t58 falhar em todos os labs ("alvo 2 coberto", lab 2073af3).
test("t58 mede cobertura só depois de rolar de forma instantânea", () => {
  const src = readFileSync(join(process.cwd(), "tests", "e2e", "specs", "t58-2fa-chave-texto.spec.ts"), "utf8");
  const chamadas = src.match(/scrollIntoView\(\{[^}]*\}\)/g) ?? [];
  assert.ok(chamadas.length >= 2);
  for (const c of chamadas) assert.match(c, /behavior:\s*"instant"/, c);
});

// Lab 245c9a9b/e611dce4: "Test timeout of 45000ms exceeded" no t58. O test.setTimeout(90000) vinha DEPOIS do
// goto + clique e a limpeza do `finally` não rodava a tempo, deixando o 2FA ativo para o retry (que falhava sem erro).
test("t58 amplia o prazo do teste antes de qualquer navegação", () => {
  const src = readFileSync(join(process.cwd(), "tests", "e2e", "specs", "t58-2fa-chave-texto.spec.ts"), "utf8");
  const testes = src.split(/\n\s*test\("/).slice(1);
  assert.equal(testes.length, 2);
  for (const t of testes) {
    const prazo = t.indexOf("test.setTimeout(");
    const ir = t.indexOf("page.goto(");
    assert.ok(prazo >= 0 && prazo < ir, "setTimeout deve vir antes do primeiro goto");
  }
  assert.doesNotMatch(src, /test\.setTimeout\(90000\)/);
});

// Lab baccf210: t185 "flutuante tampa precos-botoes" — o scrollIntoView animado (scroll-smooth) deixava o alvo
// ainda a caminho quando o boundingBox era medido, e ele parecia cruzar o botão fixo do canto.
test("t185 mede o flutuante só depois de rolar de forma instantânea", () => {
  const src = readFileSync(join(process.cwd(), "tests", "e2e", "specs", "t185-precos-3s.spec.ts"), "utf8");
  const chamadas = src.match(/scrollIntoView\(\{[^}]*\}\)/g) ?? [];
  assert.ok(chamadas.length >= 2);
  for (const c of chamadas) assert.match(c, /behavior:\s*"instant"/, c);
});
