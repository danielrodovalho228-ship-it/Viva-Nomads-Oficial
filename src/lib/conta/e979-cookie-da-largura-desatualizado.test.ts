/*
  E979 — o cookie da largura da tela (vn-tela) fica desatualizado quando a largura muda FORA do painel (janela
  estreitada numa página pública, tablet girado com o site fechado): o painel é o único lugar que o regrava. Com
  "larga" guardado e a tela hoje estreita, o proxy mandava o 1º carregamento de /dashboard/conta para o Perfil, e a
  pessoa não via o menu da Conta (achado da triagem do E744; reproduzido no pacote visual, tela 17 a 390 px).
  Correção: o proxy marca o redirecionamento Conta → Perfil; no Perfil, se a marca existe e a tela é estreita, o
  navegador corrige o cookie e volta ao menu. Sem a marca (a pessoa abriu o Perfil pelo menu), nada acontece.
  Roda: node --test src/lib/conta/e979-cookie-da-largura-desatualizado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COOKIE_VEIO_DA_CONTA, LARGURA_COMPUTADOR, voltarAoMenuDaConta } from "./redirecionar-no-servidor.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("volta ao menu só quando veio do redirecionamento do proxy E a tela é estreita E não há âncora antiga", () => {
  assert.equal(voltarAoMenuDaConta({ veioDoProxy: true, largura: 390, destinoDaAncora: null }), true);
  assert.equal(voltarAoMenuDaConta({ veioDoProxy: true, largura: LARGURA_COMPUTADOR - 1, destinoDaAncora: null }), true);
  // Computador: o redirecionamento estava certo.
  assert.equal(voltarAoMenuDaConta({ veioDoProxy: true, largura: LARGURA_COMPUTADOR, destinoDaAncora: null }), false);
  assert.equal(voltarAoMenuDaConta({ veioDoProxy: true, largura: 1280, destinoDaAncora: null }), false);
  // Sem a marca: a pessoa abriu o Perfil pelo menu da Conta, no celular. Fica no Perfil.
  assert.equal(voltarAoMenuDaConta({ veioDoProxy: false, largura: 390, destinoDaAncora: null }), false);
  // Âncora antiga (/dashboard/conta#documento): quem decide é o encaminhamento da âncora (E798), não a volta ao menu.
  assert.equal(voltarAoMenuDaConta({ veioDoProxy: true, largura: 390, destinoDaAncora: "/dashboard/conta/dados#documento" }), false);
});

test("o proxy marca SÓ o redirecionamento Conta → Perfil, com cookie curto e restrito à Conta", () => {
  const proxy = ler("proxy.ts");
  const bloco = proxy.slice(proxy.indexOf("const contaParaOnde"), proxy.indexOf("DEMAIS ROTAS PRIVADAS"));
  assert.match(bloco, /if \(marcaDoRedirecionamentoDaConta\(pathname\)\) r\.cookies\.set\(\{ name: COOKIE_VEIO_DA_CONTA, value: "1", path: "\/dashboard\/conta", maxAge: 30, sameSite: "lax" \}\);/);
  assert.match(bloco, /Cache-Control", "private, no-store"/);
  assert.equal(COOKIE_VEIO_DA_CONTA, "vn-conta-proxy");
});

test("a marca vale para /dashboard/conta e não para /dashboard/conta/avaliacoes", async () => {
  const { marcaDoRedirecionamentoDaConta } = await import("./redirecionar-no-servidor.ts");
  assert.equal(marcaDoRedirecionamentoDaConta("/dashboard/conta"), true);
  assert.equal(marcaDoRedirecionamentoDaConta("/dashboard/conta/"), true);
  assert.equal(marcaDoRedirecionamentoDaConta("/dashboard/conta/avaliacoes"), false);
  assert.equal(marcaDoRedirecionamentoDaConta("/dashboard/conta/perfil"), false);
});

test("o Perfil monta a correção, que apaga a marca, corrige o cookie da largura e troca de documento", () => {
  const pagina = ler("app/(dashboard)/dashboard/conta/[secao]/page.tsx");
  assert.match(pagina, /<VoltarAoMenuSeTelaEstreita \/>/);
  const comp = ler("components/account/largura-e-ancora.tsx");
  const corpo = comp.slice(comp.indexOf("export function VoltarAoMenuSeTelaEstreita"));
  assert.match(corpo, /voltarAoMenuDaConta\(/);
  // A marca some SEMPRE (também no computador): vale para um carregamento só.
  assert.ok(corpo.indexOf("max-age=0") > -1 && corpo.indexOf("max-age=0") < corpo.indexOf("voltarAoMenuDaConta("), "apaga a marca antes de decidir");
  // Antes de voltar, o cookie da largura fica certo — senão o proxy redirecionaria de novo (laço).
  assert.ok(corpo.indexOf(`\${COOKIE_TELA}=estreita`) > -1 && corpo.indexOf(`\${COOKIE_TELA}=estreita`) < corpo.indexOf('location.replace("/dashboard/conta")'));
  // Só em efeito (nada no 1º render do servidor).
  assert.match(corpo, /useEffect\(/);
});

test("E798 intacto: sem cookie, ou com 'estreita', o proxy não redireciona /dashboard/conta", async () => {
  const { redirecionamentoDaConta } = await import("./redirecionar-no-servidor.ts");
  assert.equal(redirecionamentoDaConta("/dashboard/conta", new URLSearchParams(), undefined), null);
  assert.equal(redirecionamentoDaConta("/dashboard/conta", new URLSearchParams(), "estreita"), null);
  assert.equal(redirecionamentoDaConta("/dashboard/conta", new URLSearchParams(), "larga"), "/dashboard/conta/perfil");
});
