import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoCapaNoEditor, capaDoParceiro } from "./apresentacao.ts";

test("E341 — o editor diz qual foto vale como capa e como trocar (nunca 'sem capa' quando a página mostra uma)", () => {
  assert.equal(avisoCapaNoEditor("capa"), "Esta é a capa da sua página.");
  assert.match(avisoCapaNoEditor("galeria"), /^Sem capa própria: sua página usa como capa a 1ª foto da sua galeria\. Envie uma capa/);
  assert.match(avisoCapaNoEditor("foto"), /sua foto de perfil/);
  assert.match(avisoCapaNoEditor("categoria"), /foto ilustrativa da sua categoria/);
  for (const o of ["capa", "galeria", "foto", "categoria"] as const) assert.doesNotMatch(avisoCapaNoEditor(o), /Sem capa ainda/);
  // A mesma regra da página pública (E306): sem capa, a 1ª da galeria.
  const c = capaDoParceiro({ nomePublico: "Ana", bannerUrl: null, galeriaCapaUrl: "g.webp", avatarUrl: "a.webp", categorias: ["limpeza"] });
  assert.equal(c?.origem, "galeria");
});

test("E341 — a prévia do editor usa capaDoParceiro com a galeria em ordem, como a página pública", () => {
  const painel = readFileSync(new URL("../../app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx", import.meta.url), "utf8");
  assert.match(painel, /const capa = capaDoParceiro\(\{ nomePublico: p\.nomePublico, bannerUrl, galeriaCapaUrl: \[\.\.\.galeria\]\.sort\(\(a, b\) => a\.ordem - b\.ordem\)\[0\]\?\.url \?\? null, avatarUrl, categorias: p\.categorias \}\);/);
  assert.match(painel, /data-testid="parceiro-capa-aviso" data-origem=\{capa\?\.origem \?\? "nenhuma"\}/);
  assert.doesNotMatch(painel, /Sem capa ainda \(opcional\)\./);
  const pagina = readFileSync(new URL("../../app/(public)/parceiros/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /capaDoParceiro\(\{ \.\.\.p, galeriaCapaUrl: galeria\[0\]\?\.url \?\? null \}\)/);
});
