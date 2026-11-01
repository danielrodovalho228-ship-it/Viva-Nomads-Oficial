import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("varredura 01/11 (1): a faixa do imóvel diz 'Proprietário:', nunca 'Anfitrião:'", () => {
  const faixa = ler("components/property/faixa-proprietario.tsx");
  assert.match(faixa, /Proprietário: <span data-testid="faixa-nome">/);
  assert.doesNotMatch(faixa, /Anfitrião:/);
  assert.doesNotMatch(ler("app/(dashboard)/dashboard/locacoes/locacoes-client.tsx"), /`Anfitrião:/);
});

test("varredura 01/11 (2): no anúncio de exemplo o botão da visita não diz 'pedida'", () => {
  const v = ler("components/property/visita-video.tsx");
  assert.match(v, /\{enviado && !demo && !exemplo \? \(/);
});
