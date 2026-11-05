/*
  E447 — /parceiros: "Sou fotógrafo", "Quero atender" (Limpeza) e "Pedir parceria" (Seguros) levam a
  /parceiros?categoria=…#quero-ser-parceiro, mas nenhuma caixa vinha marcada. O formulário só lia a categoria da URL no
  estado inicial (useState); como os botões ficam na MESMA página, a navegação não recria o formulário e a categoria
  nova era ignorada. Correção: a categoria da URL entra marcada também quando muda com a página aberta (sem desmarcar
  o que a pessoa já escolheu e sem mexer num pedido já enviado).
  Roda: node --test src/lib/parceiros/e447-categoria-url.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categoriasComDaUrl } from "./regras.ts";

test("a categoria da URL entra marcada; o que já estava marcado fica; repetida não duplica", () => {
  assert.deepEqual(categoriasComDaUrl([], "fotografia"), ["fotografia"]);
  assert.deepEqual(categoriasComDaUrl(["limpeza"], "fotografia"), ["limpeza", "fotografia"]);
  assert.deepEqual(categoriasComDaUrl(["fotografia"], "fotografia"), ["fotografia"]);
  assert.deepEqual(categoriasComDaUrl(["limpeza"], undefined), ["limpeza"]);
  assert.deepEqual(categoriasComDaUrl([], "vistoria"), [], "fora do catálogo não entra");
});

test("o formulário aplica a categoria da URL também quando ela muda com a página aberta", () => {
  const f = readFileSync(new URL("../../components/parceiros/seja-parceiro-form.tsx", import.meta.url), "utf8");
  assert.match(f, /if \(categoriaDaUrl !== categoriaInicial\) \{\s*setCategoriaDaUrl\(categoriaInicial\);\s*if \(!sol\?\.categorias\?\.length\) setC\(\(x\) => \(\{ \.\.\.x, categorias: categoriasComDaUrl\(x\.categorias, categoriaInicial\) \}\)\);/);
});
