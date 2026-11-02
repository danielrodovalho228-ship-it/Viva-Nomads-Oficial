/* Roda: node --test src/lib/trechos-estadia.test.ts — resíduo "Estadia mínima" (02/11): no cartão de Meus anúncios a linha
   da estadia mínima quebrava no meio dos termos ("R$ 250" sozinho, longe de "limpeza de saída"). Cada termo vira um bloco
   que não quebra; o texto lido é o mesmo. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { trechosDaEstadia } from "./trechos-estadia.ts";

const LINHA = "Estadia mínima (3 meses): R$ 12.580 · 3 × R$ 3.960 + limpeza de preparação R$ 450 + limpeza de saída R$ 250";

test("os termos da conta, com os separadores, e o texto remontado é idêntico", () => {
  const t = trechosDaEstadia(LINHA);
  assert.deepEqual(t.map((x) => x.texto), ["Estadia mínima (3 meses): R$ 12.580", "3 × R$ 3.960", "limpeza de preparação R$ 450", "limpeza de saída R$ 250"]);
  assert.deepEqual(t.map((x) => x.separador), ["", " · ", " + ", " + "]);
  assert.equal(t.map((x) => x.separador + x.texto).join(""), LINHA);
  assert.deepEqual(trechosDaEstadia("Estadia mínima (1 mês)"), [{ texto: "Estadia mínima (1 mês)", separador: "" }]);
  assert.deepEqual(trechosDaEstadia("R$ 6.400 em 2 meses"), [{ texto: "R$ 6.400 em 2 meses", separador: "" }]);
});

test("o preço com contexto desenha cada termo sem quebra interna", () => {
  const c = readFileSync(new URL("../components/preco/preco-com-contexto.tsx", import.meta.url), "utf8");
  assert.match(c, /trechosDaEstadia\(rotulo\.estadia\)\.map/);
  assert.match(c, /<span className="whitespace-nowrap">\{t\.texto\}<\/span>/);
});
