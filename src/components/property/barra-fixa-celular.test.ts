import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const barra = ler("components/property/barra-fixa-celular.tsx");

test("c9d21980 D1: o link Caução e taxas não fica em linha com truncate e tem alvo de toque de 44 px", () => {
  assert.doesNotMatch(barra, /<p className="truncate/);
  assert.match(barra, /data-testid="barra-total"[\s\S]{0,200}min-h-11/);
  assert.match(barra, /data-testid="barra-detalhe"/);
});

test("c9d21980 D1: o aviso de demonstração fica num bloco próprio, fora do link", () => {
  const demo = barra.indexOf('data-testid="barra-demo"');
  const link = barra.lastIndexOf("<Link", barra.indexOf('data-testid="barra-total"'));
  assert.ok(demo > -1 && link > demo);
  assert.doesNotMatch(barra.slice(demo, link), /<Link/);
});

test("c9d21980 D2: a barra recarrega ao voltar pelo cache de página (pageshow persisted)", () => {
  assert.match(barra, /addEventListener\("pageshow"/);
  assert.match(barra, /e\.persisted/);
  assert.match(barra, /router\.refresh\(\)/);
});

test("c9d21980 D2: a barra é remontada por imóvel (key) e usa o mesmo cálculo do cartão", () => {
  const detalhe = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(detalhe, /<BarraFixaCelular\s+key=\{property\.id\}/);
  assert.match(detalhe, /totalMensal: calcularTotalMensal\(property\)\.total/);
  assert.match(ler("components/property/price-card.tsx"), /calcularTotalMensal\(property\)/);
});
