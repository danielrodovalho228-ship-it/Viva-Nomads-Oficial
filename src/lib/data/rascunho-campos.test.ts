import assert from "node:assert/strict";
import { test } from "node:test";

import { fatosDaLinha, prontidaoAnuncio } from "../anuncio/prontidao.ts";
import { camposDeConteudoDoRascunho } from "./rascunho-campos.ts";

test("bairro, banheiros, área e descrição viram colunas (address = bairro, como na publicação)", () => {
  const c = camposDeConteudoDoRascunho({ neighborhood: "  Centro ", bathrooms: 1, areaM2: 45, description: " Studio " });
  assert.deepEqual(c, { address: "Centro", bathrooms: 1, area_m2: 45, description: "Studio" });
});

test("vazio ou inválido vira 0/'' (nunca NaN nem negativo)", () => {
  const c = camposDeConteudoDoRascunho({ bathrooms: Number.NaN, areaM2: -3 });
  assert.deepEqual(c, { address: "", bathrooms: 0, area_m2: 0, description: "" });
});

test("rascunho com endereço e detalhes salvos: checklist marca endereço e detalhes como feitos", () => {
  const col = camposDeConteudoDoRascunho({ neighborhood: "Centro", bathrooms: 1, areaM2: 45 });
  const fatos = fatosDaLinha(
    { title: "Rascunho de anúncio", city: "Uberlândia", min_period_days: 30, monthly_price: 0, ...col } as Parameters<typeof fatosDaLinha>[0],
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
  for (const campo of ["neighborhood", "bathrooms", "areaM2", "description"]) assert.ok(bloco.includes(campo), campo);
});
