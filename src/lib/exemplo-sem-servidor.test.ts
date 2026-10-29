// Ordem 4e2c5382 (t130): anúncio de exemplo (ube-001…) não chama o servidor ao abrir nem ao clicar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("t130: o aviso de pets da candidatura não consulta o servidor para anúncio de exemplo", () => {
  const aviso = readFileSync(new URL("../components/property/aviso-pet-candidatura.tsx", import.meta.url), "utf8");
  const detalhe = readFileSync(new URL("../app/(public)/imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
  assert.match(detalhe, /<AvisoPetCandidatura[^>]*exemplo=\{exemplo\}/, "property-detail repassa exemplo ao aviso de pets");
  const iChecagem = aviso.indexOf("if (exemplo) return");
  const iChamada = aviso.indexOf("meusPets()");
  assert.ok(iChecagem > -1 && iChecagem < iChamada, "a checagem de exemplo vem antes de meusPets()");
});
