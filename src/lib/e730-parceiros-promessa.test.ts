// E730 (Phoenix/RELATORIO-002, C5): a página de parceiros anunciava Fotógrafos, Gestão e Avaliação, e o formulário só traz as
// categorias de serviço (Avaliação é credenciamento à parte). A página passa a dizer o que o formulário entrega.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIAS_CATALOGO } from "./parceiros/regras.ts";

const pagina = readFileSync("src/app/(public)/parceiros/page.tsx", "utf8");

test("E730: a nota dos tipos de parceria cita exatamente as categorias que o formulário oferece", () => {
  const nota = pagina.slice(pagina.indexOf('data-testid="parceiros-tipos-nota"'), pagina.indexOf("</p>", pagina.indexOf('data-testid="parceiros-tipos-nota"')));
  for (const c of CATEGORIAS_CATALOGO) {
    const palavra = c.rotulo.toLowerCase().replace("montagem de móveis", "montagem").replace("outro serviço", "outro serviço");
    assert.ok(nota.toLowerCase().includes(palavra), `a nota cita ${palavra}`);
  }
  assert.match(nota, /credenciamento à parte/);
  assert.match(nota, /Empresas e gestores têm página própria/);
});

test("E730: o título da página não promete 'gestores' como parceria do formulário", () => {
  assert.match(pagina, /title: "Seja parceiro: fotógrafos e serviços"/);
  assert.doesNotMatch(pagina, /fotógrafos e gestores/);
});

// E758: o que a página anuncia (Avaliação, com bloco próprio) x o que a busca entrega (só as categorias do catálogo).
test("E758: a página diz que Avaliação não está na busca de parceiros e a busca não a lista", () => {
  assert.match(pagina, /A busca de parceiros traz só as categorias de serviço/);
  assert.match(pagina, /Não aparece na busca de parceiros/);
  assert.ok(!CATEGORIAS_CATALOGO.some((c) => /avalia|vistoria/i.test(`${c.valor} ${c.rotulo}`)));
});
