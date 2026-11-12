/* Roda: node --test src/lib/parceiros/e362-conferencia-portfolio.test.ts
  E362: o "Como funciona" de /parceiros só promete conferir o que o pedido realmente pede: identidade e CPF ou CNPJ para todos, e o portfólio
  só em fotografia (o campo do formulário aparece e é obrigatório só nessa categoria). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync("src/app/(public)/parceiros/page.tsx", "utf8");
const form = readFileSync("src/components/parceiros/seja-parceiro-form.tsx", "utf8");
const regras = readFileSync("src/lib/parceiros/regras.ts", "utf8");

test("E362: a página não promete portfólio para todo parceiro", () => {
  assert.doesNotMatch(pagina, /Identidade, CPF ou CNPJ e portfólio/);
  assert.match(pagina, /o seu documento e o CNPJ \(a verificação automática de identidade ainda não abriu\); para fotografia, também o portfólio\./); // E757: texto único da identidade
});

test("E362: o formulário tem o campo de portfólio só em fotografia, e o servidor exige o link nessa categoria", () => {
  assert.match(form, /temCategoria\("fotografia"\) && \([\s\S]{0,200}Link do portfólio \(obrigatório para fotografia\)/);
  assert.match(regras, /categorias\.includes\("fotografia"\) && !portfolioUrl\) return \{ ok: false, erro: "Para fotografia, mande o link do seu portfólio\.", campo: "portfolioUrl" \}/);
});
