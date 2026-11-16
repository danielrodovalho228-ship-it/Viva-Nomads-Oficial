/*
  E989 — soltar fotos durante um envio apagava o lote anterior (a galeria do começo do 2º lote, sem o 1º, sobrescrevia
  a galeria no fim). Regra: lotes em fila; cada um junta as fotos à galeria ATUAL quando termina.
  Roda: node --test src/lib/fotos/e989-lotes-em-fila.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarFila, galeriaComLote } from "./fila-de-lotes.ts";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("E989 — o defeito: dois lotes com a cópia do começo → o 1º some", async () => {
  let galeria = ["a"];
  const lote = async (novas: string[], ms: number) => {
    const doComeco = galeria; // o que o código antigo fazia
    await espera(ms);
    galeria = [...doComeco, ...novas];
  };
  await Promise.all([lote(["b1", "b2"], 30), lote(["c1"], 50)]);
  assert.deepEqual(galeria, ["a", "c1"]); // b1/b2 apagados — é exatamente o achado
});

test("E989 — em fila e juntando à galeria atual, os dois lotes ficam (na ordem em que foram soltos)", async () => {
  let galeria = ["a"];
  const fila = criarFila();
  const lote = (novas: string[], ms: number) =>
    fila(async () => {
      await espera(ms);
      galeria = galeriaComLote(galeria, novas);
    });
  await Promise.all([lote(["b1", "b2"], 50), lote(["c1"], 10)]);
  assert.deepEqual(galeria, ["a", "b1", "b2", "c1"]);
});

test("E989 — a fila segue depois de um lote que falhou", async () => {
  const fila = criarFila();
  const ordem: string[] = [];
  const p1 = fila(async () => {
    ordem.push("1");
    throw new Error("rede");
  }).catch(() => ordem.push("1-falhou"));
  const p2 = fila(async () => {
    ordem.push("2");
  });
  await Promise.all([p1, p2]);
  assert.deepEqual(ordem, ["1", "1-falhou", "2"]);
});

test("E989 — o enviador de fotos usa a fila e a galeria atual (fotosRef), não a cópia do começo", () => {
  const s = readFileSync("src/components/photo-uploader.tsx", "utf8");
  assert.match(s, /await filaRef\.current\(\(\) => enviarLote\(lista\)\)/);
  assert.match(s, /const final = comPrincipalBoa\(galeriaComLote\(fotosRef\.current, novas\)\);/);
  assert.doesNotMatch(s, /onChange\(comPrincipalBoa\(\[\.\.\.photos, \.\.\.novas\]\)\)/);
});
