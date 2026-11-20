/*
  E833 — trava nomeada (ORDEM-DUET-227). O item: "o botão 'Quero anunciar meu imóvel' de /para-proprietarios aponta para a
  PRÓPRIA /para-proprietarios (loop) — tem de levar ao cadastro/login de anunciar (visitante sem sessão cai no login, na
  linha do E807)". Na main 089d0734 o defeito já não se reproduz: o botão de anunciar da página leva a
  /dashboard/imoveis/novo e o proxy manda o visitante sem sessão ao login com motivo=anunciar. Esta trava prende isso.
  Roda: node --test src/lib/e833-anunciar-sem-loop.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGINA = readFileSync("src/app/(public)/para-proprietarios/page.tsx", "utf8");
const PROXY = readFileSync("src/proxy.ts", "utf8");
const links = [...PAGINA.matchAll(/<(?:ButtonLink|Link)\s+href="([^"]+)"[^>]*>\s*([^<{]*)/g)].map((m) => ({ href: m[1], texto: m[2].trim() }));

test("E833 — /para-proprietarios não tem nenhum link para ela mesma (sem loop)", () => {
  assert.ok(links.length > 3, "a página tem os botões de sempre");
  assert.deepEqual(links.filter((l) => l.href === "/para-proprietarios" || l.href.startsWith("/para-proprietarios?") || l.href === "/anunciar"), []);
});

test("E833 — o botão de anunciar da página leva ao cadastro do anúncio", () => {
  const anunciar = links.filter((l) => /anunciar/i.test(l.texto));
  assert.ok(anunciar.length >= 1, "há um botão de anunciar");
  for (const l of anunciar) assert.equal(l.href, "/dashboard/imoveis/novo", `"${l.texto}" → ${l.href}`);
});

test("E833 — visitante sem sessão cai no login de anunciar (linha do E807)", () => {
  assert.match(PROXY, /pathname\.startsWith\("\/dashboard"\)/, "/dashboard é rota protegida");
  assert.match(PROXY, /redirectUrl\.pathname = "\/auth"/, "sem sessão → /auth");
  assert.match(PROXY, /pathname\.startsWith\("\/dashboard\/imoveis\/novo"\)[^\n]*searchParams\.set\("motivo", "anunciar"\)/, "com motivo=anunciar");
});
