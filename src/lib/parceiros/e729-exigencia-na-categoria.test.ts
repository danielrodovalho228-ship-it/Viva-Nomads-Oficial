// E729 (Phoenix/RELATORIO-002, C3): quem lia o formulário antes de marcar Fotografia não sabia que o link do portfólio é
// obrigatório. A exigência agora aparece junto da categoria, antes de marcar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EXIGENCIA_DA_CATEGORIA, validarSolicitacao } from "./regras.ts";

test("E729: fotografia e mudança dizem o que pedem, e só as categorias que de fato exigem campo extra", () => {
  assert.equal(EXIGENCIA_DA_CATEGORIA.fotografia, "Pede o link do portfólio");
  assert.equal(EXIGENCIA_DA_CATEGORIA.mudanca, "Pede empresa e veículo");
  assert.deepEqual(Object.keys(EXIGENCIA_DA_CATEGORIA).sort(), ["fotografia", "mudanca"]);
});

test("E729: o cartão da categoria no formulário mostra a exigência (antes de marcar)", () => {
  const f = readFileSync("src/components/parceiros/seja-parceiro-form.tsx", "utf8");
  assert.match(f, /EXIGENCIA_DA_CATEGORIA\[k\.valor\]/);
  assert.match(f, /data-testid=\{`sp-cat-exigencia-\$\{k\.valor\}`\}/);
});

test("E729: a exigência dita é a que o servidor cobra (fotografia sem portfólio é recusada)", () => {
  const r = validarSolicitacao({ categorias: ["fotografia"], portfolioUrl: "", cidades: "Uberlândia", descricao: "", empresa: "", veiculo: "" } as never);
  assert.equal(r.ok, false);
});
