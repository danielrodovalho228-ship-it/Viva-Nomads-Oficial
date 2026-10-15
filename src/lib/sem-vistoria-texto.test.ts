/*
  Barra a palavra "vistoria" em textos que o público e os painéis leem
  (ordens d04dea00 / f77ebedf): o termo certo é "conferência de entrada/saída".
  Roda: node --test src/lib/sem-vistoria-texto.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ARQUIVOS = [
  "src/lib/atendimento/faq.ts",
  "src/lib/atendimento/viva-prompt.ts",
  "src/lib/atendimento/viva-cenarios.ts",
  "src/lib/seo/llms.ts",
  "src/lib/faixas.ts",
  "src/components/documentos/documentos-contrato.tsx",
  "src/app/(dashboard)/dashboard/reembolsos/page.tsx",
  "src/app/(dashboard)/dashboard/garantias/garantias-client.tsx",
];

for (const arq of ARQUIVOS) {
  test(`sem "vistoria" em texto visível: ${arq}`, () => {
    const txt = readFileSync(arq, "utf8");
    assert.doesNotMatch(txt, /vistoria/i);
  });
}
