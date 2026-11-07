import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Passada 55 (07/11, 390 px): o selo-menu de estado do anúncio (24 px) e as abas de "Pedidos de moradia" do dono (36 px)
// ficavam abaixo de 44 px de toque. `alvo-toque` amplia a área a 44 px só em tela de toque, sem mexer no desenho.
const estado = readFileSync(new URL("./estado-anuncio.tsx", import.meta.url), "utf8");
const abas = readFileSync(new URL("../../app/(dashboard)/dashboard/pedidos-cidade/pedidos-dono-client.tsx", import.meta.url), "utf8");

test("o selo que abre o menu de pausa tem área de toque ampliada; o selo sem menu não", () => {
  assert.match(estado, /className=\{cn\("alvo-toque", classeSelo\)\}\s+data-testid="estado-anuncio"/);
  const spans = estado.match(/<span className=\{classeSelo\}/g) ?? [];
  assert.ok(spans.length >= 2, "os selos sem menu continuam como estão");
});

test("as abas de Pedidos de moradia do dono têm área de toque ampliada", () => {
  assert.match(abas, /role="tab"[\s\S]{0,260}className=\{cn\("alvo-toque whitespace-nowrap rounded-full/);
});
