// Ordem 4e2c5382 (t130): anúncio de exemplo (ube-001…) não chama o servidor ao abrir nem ao clicar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("../components/property/owner-rating.tsx", import.meta.url), "utf8");

test("t130: a reputação do dono não consulta o servidor para anúncio de exemplo", () => {
  assert.match(fonte, /isExemplo\(propertyId\)/, "OwnerRating precisa checar isExemplo antes de getReputacaoDoImovel");
  const iExemplo = fonte.indexOf("isExemplo(propertyId)");
  const iChamada = fonte.indexOf("getReputacaoDoImovel(propertyId)");
  assert.ok(iExemplo > -1 && iExemplo < iChamada, "a checagem vem antes da chamada ao servidor");
});
