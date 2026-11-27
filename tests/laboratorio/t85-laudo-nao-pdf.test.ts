import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarLaudo, LAUDO_MIN_BYTES } from "../../src/lib/conferencia.ts";

// Lab 10/11: t85 "laudo independente na saída" mandava "isto não é um PDF de verdade" (28 bytes) e esperava
// "Envie o laudo em PDF". Desde o E669 o tamanho mínimo de laudo (1 KB) é conferido antes do tipo, então a resposta
// era "pequeno demais". O arquivo não-PDF da spec precisa ter tamanho de laudo para cair na regra do tipo.
test("t85: o arquivo não-PDF da spec tem tamanho de laudo e cai na recusa de tipo", () => {
  const spec = readFileSync("tests/e2e/specs/t85-conferencia-entrada-saida.spec.ts", "utf8");
  const linha = spec.split("\n").find((l) => l.includes('name: "laudo.pdf"')) ?? "";
  assert.doesNotMatch(linha, /buffer: Buffer\.from\("isto não é um PDF de verdade"\)/);
  assert.match(spec, /naoPdf/);
  // O mesmo conteúdo que a spec usa, conferido contra a regra real do servidor.
  const naoPdf = Buffer.concat([Buffer.from("isto não é um PDF de verdade\n"), Buffer.alloc(4096, 0x20)]);
  assert.ok(naoPdf.length >= LAUDO_MIN_BYTES);
  const r = validarLaudo({ bytes: new Uint8Array(naoPdf), tamanho: naoPdf.length });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erro, /Envie o laudo em PDF/);
});
