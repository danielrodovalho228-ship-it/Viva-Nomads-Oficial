/* Roda: node --test src/lib/preco-medio.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularPrecosMedios, rotuloQuartos } from "./preco-medio.ts";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const im = (n: number, bairro: string, quartos: number, preco: number, extra = {}) => ({
  id: uuid(n), neighborhood: bairro, bedrooms: quartos, monthlyPrice: preco, status: "active", ...extra,
});

test("média só com 3 anúncios ou mais; abaixo disso fica null", () => {
  const r = calcularPrecosMedios([
    im(1, "Centro", 2, 2000), im(2, "Centro", 2, 2500), im(3, "Centro", 2, 3000),
    im(4, "Umuarama", 1, 1800), im(5, "Umuarama", 1, 1900),
  ]);
  assert.equal(r.find((g) => g.bairro === "Centro")?.media, 2500);
  assert.equal(r.find((g) => g.bairro === "Umuarama")?.media, null);
  assert.equal(r.find((g) => g.bairro === "Umuarama")?.anuncios, 2);
});

test("exemplo, não publicado e sem preço ficam de fora do corte de 3", () => {
  const r = calcularPrecosMedios([
    im(1, "Centro", 2, 2000), im(2, "Centro", 2, 2000),
    { id: "ube-001", neighborhood: "Centro", bedrooms: 2, monthlyPrice: 9000, status: "active" },
    im(3, "Centro", 2, 2000, { status: "draft" }),
    im(4, "Centro", 2, 0),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].anuncios, 2);
  assert.equal(r[0].media, null);
});

test("bairro com acento/caixa diferente agrupa junto; quartos separam", () => {
  const r = calcularPrecosMedios([
    im(1, "Santa Mônica", 1, 1000), im(2, "santa monica", 1, 2000), im(3, "Santa Mônica", 1, 3000),
    im(4, "Santa Mônica", 2, 5000),
  ]);
  assert.equal(r.length, 2);
  assert.equal(r[0].media, 2000);
  assert.equal(r[1].quartos, 2);
});

test("rótulos de quartos", () => {
  assert.deepEqual([0, 1, 3].map(rotuloQuartos), ["Studio", "1 quarto", "3 quartos"]);
});
