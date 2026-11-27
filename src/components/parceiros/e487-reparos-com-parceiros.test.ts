import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/*
  E487: no cartão de serviços de parceiros, "Manutenção" confundia o morador com o chamado de manutenção ao
  proprietário. No cartão o serviço passa a se chamar "Reparos com parceiros"; o destino (categoria manutencao) e o
  nome da categoria no cadastro do parceiro e na busca pública não mudam.
*/
test("E487: o cartão de serviços mostra 'Reparos com parceiros' no lugar de 'Manutenção'", () => {
  const src = ler("components/parceiros/servicos-painel.tsx");
  assert.match(src, /manutencao: "Reparos com parceiros"/);
  assert.match(src, /ROTULO_NO_CARTAO\[c\.valor\] \?\? c\.rotulo/);
});

test("E487: a categoria continua 'manutencao' (mesmo destino) e o catálogo segue com 'Manutenção'", () => {
  const regras = ler("lib/parceiros/regras.ts");
  assert.match(regras, /\{ valor: "manutencao", rotulo: "Manutenção" \}/);
  const src = ler("components/parceiros/servicos-painel.tsx");
  assert.match(src, /href=\{q\(c\.valor\)\}/);
});
