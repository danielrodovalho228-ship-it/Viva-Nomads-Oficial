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

test("t130: o aviso de pets da candidatura não consulta o servidor para anúncio de exemplo", () => {
  const aviso = readFileSync(new URL("../components/property/aviso-pet-candidatura.tsx", import.meta.url), "utf8");
  const detalhe = readFileSync(new URL("../app/(public)/imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
  assert.match(detalhe, /<AvisoPetCandidatura[^>]*exemplo=\{exemplo\}/, "property-detail repassa exemplo ao aviso de pets");
  const iChecagem = aviso.indexOf("if (exemplo) return");
  const iChamada = aviso.indexOf("meusPets()");
  assert.ok(iChecagem > -1 && iChecagem < iChamada, "a checagem de exemplo vem antes de meusPets()");
});
