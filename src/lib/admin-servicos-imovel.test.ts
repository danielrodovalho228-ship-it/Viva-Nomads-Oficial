/** Onda 5 (matriz admin-servicos): cada pedido de serviço mostra o imóvel, como no mockup — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhaImovelServico } from "./servicos-morador.ts";

test("título · bairro, cidade; partes faltando somem; sem imóvel, nada", () => {
  assert.equal(linhaImovelServico({ title: "Studio Centro", address: "Centro", city: "Uberlândia" }), "Studio Centro · Centro, Uberlândia");
  assert.equal(linhaImovelServico({ title: "Studio Centro", address: null, city: "Uberlândia" }), "Studio Centro · Uberlândia");
  assert.equal(linhaImovelServico({ title: null, address: null, city: null }), null);
  assert.equal(linhaImovelServico(null), null);
});

test("o admin lê o imóvel do pedido e o cartão mostra 'Imóvel:'", () => {
  const dados = readFileSync(new URL("./data/servicos-morador-actions.ts", import.meta.url), "utf8");
  assert.match(dados, /properties:property_id\(title, address, city\)/);
  const tela = readFileSync(new URL("../app/(dashboard)/admin/servicos/page.tsx", import.meta.url), "utf8");
  assert.match(tela, /data-testid="admin-servico-imovel"/);
  assert.match(tela, /Imóvel: /);
});
