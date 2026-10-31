import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FRASE_CTA_IMOVEL, ROTULO_CTA_IMOVEL } from "./imovel-cta.ts";

test("IMÓVEL-CTA: o botão é 'Pedir para morar' e a frase é a do adendo de 24/10, sem 'garantia'/'protegido'", () => {
  assert.equal(ROTULO_CTA_IMOVEL, "Pedir para morar");
  assert.equal(
    FRASE_CTA_IMOVEL,
    "Enviar o pedido não custa nada e não é contrato. Se o proprietário aceitar, vocês assinam um contrato digital, e o pagamento vai direto para ele.",
  );
  assert.doesNotMatch(FRASE_CTA_IMOVEL, /garanti|protegid/i);
  // Computador (cartão de preço) e celular (barra fixa): o mesmo rótulo e a frase logo depois do botão.
  for (const arq of ["src/app/(public)/imoveis/[id]/property-detail.tsx", "src/components/property/barra-fixa-celular.tsx"]) {
    const f = readFileSync(arq, "utf8");
    assert.match(f, /ROTULO_CTA_IMOVEL/, arq);
    assert.match(f, /\{FRASE_CTA_IMOVEL\}/, arq);
    assert.doesNotMatch(f, /: "Solicitar"\}/, arq);
  }
});
