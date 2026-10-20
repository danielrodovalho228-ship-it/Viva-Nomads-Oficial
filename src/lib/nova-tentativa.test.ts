import test from "node:test";
import assert from "node:assert/strict";
import { comNovaTentativa, urlDeNovaTentativaTile } from "./nova-tentativa.ts";

test("tenta de novo uma vez quando a primeira falha e devolve a segunda", async () => {
  let n = 0;
  const r = await comNovaTentativa(async () => (++n === 1 ? { erro: true } : { erro: false }), (x) => x.erro, 1);
  assert.equal(n, 2);
  assert.equal(r.erro, false);
});

test("não repete quando a primeira dá certo", async () => {
  let n = 0;
  await comNovaTentativa(async () => (++n, { erro: false }), (x) => x.erro, 1);
  assert.equal(n, 1);
});

test("exceção na segunda tentativa sobe; na primeira é absorvida", async () => {
  let n = 0;
  const r = await comNovaTentativa(async () => { if (++n === 1) throw new Error("rede"); return "ok"; }, () => false, 1);
  assert.equal(r, "ok");
  await assert.rejects(comNovaTentativa(async () => { throw new Error("x"); }, () => false, 1));
});

test("tile: só uma nova tentativa, com cache-buster", () => {
  assert.equal(urlDeNovaTentativaTile("https://t/1.png", 0), "https://t/1.png?retry=1");
  assert.equal(urlDeNovaTentativaTile("https://t/1.png?a=b", 0), "https://t/1.png?a=b&retry=1");
  assert.equal(urlDeNovaTentativaTile("https://t/1.png", 1), null);
});
