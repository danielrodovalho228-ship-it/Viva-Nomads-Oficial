/*
  Telas da Conta: os estilos do mockup aprovado (caixa alta no rótulo, título grande, sombra) moram num arquivo só e
  só ele fica isento da guarda de estilo. Roda: node --test src/lib/conta/visual-mockup.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CASCA_SOMBRA_CARTOES, ROTULO_MENU_CONTA, SOMBRA_CARTAO_CONTA, TITULO_TELA_CONTA } from "./visual-mockup.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("os estilos do mockup: rótulo em caixa alta espaçada, título acima de 28 px, sombra suave", () => {
  assert.match(ROTULO_MENU_CONTA, /uppercase/);
  assert.match(ROTULO_MENU_CONTA, /tracking-/);
  assert.match(TITULO_TELA_CONTA, /text-4xl/);
  assert.match(TITULO_TELA_CONTA, /lg:text-5xl/);
  assert.match(SOMBRA_CARTAO_CONTA, /^shadow-\[/);
  assert.match(CASCA_SOMBRA_CARTOES, /\[&_section\.bg-white\]:shadow-\[/);
});

test("a casca usa os estilos do mockup e a guarda isenta só este arquivo", () => {
  const casca = ler("src/components/account/casca-conta.tsx");
  for (const c of ["ROTULO_MENU_CONTA", "TITULO_TELA_CONTA", "SOMBRA_CARTAO_CONTA", "CASCA_SOMBRA_CARTOES"]) assert.match(casca, new RegExp(c), c);
  assert.doesNotMatch(casca, /uppercase|tracking-|text-5xl|shadow-\[/);
  const guarda = ler("src/lib/estilo/estilo-padrao.test.ts");
  assert.match(guarda, /if \(f === "lib\/conta\/visual-mockup\.ts"\) continue;/);
  assert.equal((guarda.match(/visual-mockup/g) ?? []).length, 1);
});

test("mockup perfil-01: cabeçalho com foto na Conta, menos na tela Perfil (E55: iniciais); nome completo no espelho", () => {
  const shell = ler("src/components/layout/dashboard-shell.tsx");
  assert.match(shell, /const naTelaPerfil = pathname === "\/dashboard\/conta\/perfil" \|\| pathname === "\/dashboard\/conta";/);
  assert.match(shell, /const fotoNav = naTelaPerfil \? null : myPhoto;/);
  assert.match(ler("src/components/account/espelho-perfil.tsx"), /nomeNoEspelho\(nome\)/);
});

test("/dashboard/conta no celular não monta o Perfil do computador (as ações dele devolviam a URL ao menu)", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/conta/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /window\.matchMedia\("\(min-width: 1024px\)"\)/);
  assert.match(pagina, /\{computador && \(\s*<div className="hidden lg:block" data-so-computador>/);
});

test("âncoras antigas de /dashboard/conta trocam de documento (fora da fila das Server Actions)", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/conta/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /if \(destino\) window\.location\.replace\(destino\);/);
  assert.doesNotMatch(pagina, /router\.replace/);
});
