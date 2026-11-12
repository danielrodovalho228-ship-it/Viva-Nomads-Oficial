import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  E795: a barra fixa de abas da página do imóvel (nav-secoes) era translúcida (bg-white/95 + backdrop-blur). Ao rolar, a
  linha "Costuma responder em até 8 horas" (e qualquer texto) aparecia borrada através da barra, como se cortada por ela.
  A barra é opaca; as âncoras continuam com scroll-mt-36 (144 px), abaixo do cabeçalho (72 px) e da barra (~48 px).
*/
const nav = readFileSync("src/components/property/nav-secoes.tsx", "utf8");
const classe = nav.match(/data-testid="nav-secoes"\s*\n\s*className="([^"]+)"/)?.[1] ?? "";

test("a barra de abas é opaca: fundo branco cheio, sem transparência nem desfoque", () => {
  assert.ok(classe, "classe da nav-secoes encontrada");
  assert.match(classe, /(^|\s)bg-white(\s|$)/);
  assert.doesNotMatch(classe, /bg-white\/\d+|backdrop-blur/);
});

test("as âncoras da página param abaixo do cabeçalho e da barra", () => {
  const pagina = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  for (const id of ["visao-geral", "comodidades", "disponibilidade", "localizacao", "avaliacoes", "proprietario"])
    assert.match(pagina, new RegExp(`id="${id}" className="scroll-mt-36`));
});
