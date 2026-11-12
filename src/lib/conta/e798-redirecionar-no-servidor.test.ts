/*
  E798 (prova ao vivo do piloto, 12/11): /dashboard/conta e /dashboard/conta/avaliacoes abriam com a área principal em
  branco e redirecionavam no CLIENTE. O redirecionamento passa ao servidor (proxy, antes de desenhar):
   - /dashboard/conta/avaliacoes → /dashboard/avaliacoes?aba=recebidas (+ filtro e busca), sempre;
   - /dashboard/conta → /dashboard/conta/perfil no COMPUTADOR (E492), sabido pelo cookie de largura que o painel grava;
     no celular (ou sem o cookie) a página segue sendo o menu da Conta.
  Roda: node --test src/lib/conta/e798-redirecionar-no-servidor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COOKIE_TELA, destinoContaAvaliacoes, redirecionamentoDaConta, telaDaLargura } from "./redirecionar-no-servidor.ts";

test("avaliações antigas: o mesmo destino da página de antes (filtro e busca preservados)", () => {
  assert.equal(destinoContaAvaliacoes(new URLSearchParams("")), "/dashboard/avaliacoes?aba=recebidas");
  assert.equal(destinoContaAvaliacoes(new URLSearchParams("aba=recentes")), "/dashboard/avaliacoes?aba=recebidas&filtro=recentes");
  assert.equal(destinoContaAvaliacoes(new URLSearchParams("aba=positivas&q=Ana Paula")), "/dashboard/avaliacoes?aba=recebidas&filtro=positivas&q=Ana%20Paula");
  assert.equal(destinoContaAvaliacoes(new URLSearchParams("aba=outra")), "/dashboard/avaliacoes?aba=recebidas");
});

test("decisão do proxy: avaliações sempre; Conta só no computador; o resto não", () => {
  const sp = new URLSearchParams("");
  assert.equal(redirecionamentoDaConta("/dashboard/conta/avaliacoes", sp, undefined), "/dashboard/avaliacoes?aba=recebidas");
  assert.equal(redirecionamentoDaConta("/dashboard/conta", sp, "larga"), "/dashboard/conta/perfil");
  assert.equal(redirecionamentoDaConta("/dashboard/conta/", sp, "larga"), "/dashboard/conta/perfil");
  assert.equal(redirecionamentoDaConta("/dashboard/conta", sp, "estreita"), null, "celular: o menu da Conta");
  assert.equal(redirecionamentoDaConta("/dashboard/conta", sp, undefined), null, "sem o cookie: a página decide (como antes)");
  assert.equal(redirecionamentoDaConta("/dashboard/conta/perfil", sp, "larga"), null);
  assert.equal(redirecionamentoDaConta("/dashboard", sp, "larga"), null);
});

test("cookie de largura: 1024 px é o limite do E492", () => {
  assert.equal(COOKIE_TELA, "vn-tela");
  assert.equal(telaDaLargura(1024), "larga");
  assert.equal(telaDaLargura(1023), "estreita");
  assert.equal(telaDaLargura(390), "estreita");
});

test("o proxy redireciona antes de desenhar; a página antiga de avaliações usa a mesma função", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /const contaParaOnde = redirecionamentoDaConta\(pathname, request\.nextUrl\.searchParams, request\.cookies\.get\(COOKIE_TELA\)\?\.value\);/);
  assert.match(proxy, /r\.headers\.set\("Cache-Control", "private, no-store"\);/, "o redirecionamento depende do cookie do aparelho: sem cache compartilhado");
  assert.ok(proxy.indexOf("redirecionamentoDaConta(pathname") < proxy.indexOf("DEMAIS ROTAS PRIVADAS"), "antes da sessão (não depende dela)");
  const av = readFileSync("src/app/(dashboard)/dashboard/conta/avaliacoes/page.tsx", "utf8");
  assert.match(av, /redirect\(destinoContaAvaliacoes\(/);
  // O painel grava a largura (casca) e o Perfil encaminha as âncoras antigas da página longa.
  assert.match(readFileSync("src/components/layout/dashboard-shell.tsx", "utf8"), /<GravarLarguraDaTela \/>/);
  assert.match(readFileSync("src/app/(dashboard)/dashboard/conta/[secao]/page.tsx", "utf8"), /<AncoraAntigaDaConta \/>/);
});
