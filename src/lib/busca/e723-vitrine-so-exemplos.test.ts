import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { soHaExemplos, TEXTO_VITRINE_SO_EXEMPLOS } from "./exemplos-e-pedido.ts";

const ehEx = (x: { id: string }) => x.id.startsWith("ube-");

test("E723: a lista só de exemplos é detectada; com um real, ou vazia, não", () => {
  assert.equal(soHaExemplos([{ id: "ube-001" }, { id: "ube-002" }], ehEx), true);
  assert.equal(soHaExemplos([{ id: "ube-001" }, { id: "real-1" }], ehEx), false);
  assert.equal(soHaExemplos([], ehEx), false);
});

test("E723: a /buscar avisa no topo quando só há exemplos (e o aviso não promete imóvel real)", () => {
  const s = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
  assert.match(s, /soHaExemplos\(results, \(p\) => isExemplo\(p\.id\)\) && !exemplosForcados/);
  assert.match(s, /data-testid="busca-so-exemplos"/);
  assert.match(TEXTO_VITRINE_SO_EXEMPLOS, /Ainda não há imóveis reais publicados/);
});
