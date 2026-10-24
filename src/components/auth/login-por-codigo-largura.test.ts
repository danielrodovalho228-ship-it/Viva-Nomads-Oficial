import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// t203 (lab 24/10): o e-mail longo em "Código enviado para …" estourava a largura a 390 px.
const fonte = readFileSync(new URL("./login-por-codigo.tsx", import.meta.url), "utf8");

test("avisos do código quebram e-mail longo dentro do cartão", () => {
  assert.match(fonte, /<span className="min-w-0 \[overflow-wrap:anywhere\]">Código enviado para \{email\.trim\(\)\}\.<\/span>/);
  assert.match(fonte, /<span className="min-w-0 \[overflow-wrap:anywhere\]">\{aviso\}<\/span>/);
});
