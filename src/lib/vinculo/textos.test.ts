import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELO_VINCULO, detalheVinculo } from "./textos.ts";

test("o selo mostra o nome do domínio e nada mais", () => {
  assert.equal(detalheVinculo("hospital.org.br"), "Vínculo profissional confirmado · hospital.org.br");
  assert.equal(SELO_VINCULO, "Vínculo profissional confirmado");
});

test("a Conta mostra a linha do vínculo na lista de confiança", () => {
  const blocos = readFileSync(new URL("../../components/account/conta-blocos.tsx", import.meta.url), "utf8");
  assert.match(blocos, /<VinculoProfissional \/>/);
  const tela = readFileSync(new URL("../../components/account/vinculo-profissional.tsx", import.meta.url), "utf8");
  assert.match(tela, /confianca-vinculo/);
  assert.doesNotMatch(tela, /dangerouslySetInnerHTML/);
});
