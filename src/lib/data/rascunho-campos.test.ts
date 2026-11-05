import assert from "node:assert/strict";
import { test } from "node:test";

import { fatosDaLinha, prontidaoAnuncio } from "../anuncio/prontidao.ts";
import { camposDeConteudoDoRascunho } from "./rascunho-campos.ts";

test("bairro, banheiros, área e descrição viram colunas (address = bairro, como na publicação)", () => {
  const c = camposDeConteudoDoRascunho({ neighborhood: "  Centro ", bedrooms: 2, bathrooms: 1, areaM2: 45, description: " Studio " });
  assert.deepEqual(c, { address: "Centro", bedrooms: 2, bathrooms: 1, area_m2: 45, description: "Studio" });
});

test("vazio ou inválido vira 0/'' (nunca NaN nem negativo)", () => {
  const c = camposDeConteudoDoRascunho({ bathrooms: Number.NaN, areaM2: -3 });
  assert.deepEqual(c, { address: "", bedrooms: 0, bathrooms: 0, area_m2: 0, description: "" });
});

test("rascunho com endereço e detalhes salvos: checklist marca endereço e detalhes como feitos", () => {
  const col = camposDeConteudoDoRascunho({ neighborhood: "Centro", bathrooms: 1, areaM2: 45 });
  const fatos = fatosDaLinha(
    { title: "Rascunho de anúncio", city: "Uberlândia", min_period_days: 30, monthly_price: 0, ...col } as unknown as Parameters<typeof fatosDaLinha>[0],
    1,
    "none",
  );
  const faltam = prontidaoAnuncio(fatos).faltam.join("|");
  assert.ok(!faltam.includes("Endereço preenchido"), faltam);
  assert.ok(!faltam.includes("Detalhes básicos"), faltam);
});

test("o autosave (saveDraftData) grava essas colunas e o editor as envia", async () => {
  const { readFileSync } = await import("node:fs");
  const acao = readFileSync("src/lib/data/actions.ts", "utf8");
  assert.match(acao, /\.\.\.camposDeConteudoDoRascunho\(snap\)/);
  const editor = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  const bloco = editor.slice(editor.indexOf("await saveDraftData({"), editor.indexOf("await saveDraftData({") + 400);
  for (const campo of ["neighborhood", "bedrooms", "bathrooms", "areaM2", "description"]) assert.ok(bloco.includes(campo), campo);
});

// E603: o cartão da listagem mostrava "0" no ícone de cama para um rascunho de 2 quartos — a coluna `bedrooms` nunca
// era gravada pelo autosave (só banheiros e área). Agora vai junto, com o mesmo teto da publicação.
test("E603: os quartos do rascunho vão para a coluna bedrooms (a listagem lê dela)", () => {
  assert.equal(camposDeConteudoDoRascunho({ bedrooms: 2 }).bedrooms, 2);
  assert.equal(camposDeConteudoDoRascunho({ bedrooms: 0 }).bedrooms, 0, "studio sem quarto separado");
  assert.equal(camposDeConteudoDoRascunho({ bedrooms: 999 }).bedrooms, 50);
});
