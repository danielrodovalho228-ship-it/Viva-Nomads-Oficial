/* Roda: node --test src/components/property/e643-estado-fora-da-foto.test.ts
  E643: a marca de estado ("Visto" / "Você já contatou") não disputa a foto com as até 2 pílulas do E626: fica no texto do cartão. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync("src/components/property-card.tsx", "utf8");
const marca = readFileSync("src/components/property/marca-imovel.tsx", "utf8");

test("E643: a MarcaImovel não está dentro da foto do cartão", () => {
  const foto = card.slice(card.indexOf('data-testid="cartao-foto"'), card.indexOf("</div>", card.indexOf("<SelosFoto")));
  assert.doesNotMatch(foto, /MarcaImovel/);
  assert.match(card, /<MarcaImovel propertyId=\{property\.id\} \/>/);
  assert.ok(card.indexOf("<MarcaImovel") > card.indexOf('data-testid="cartao-disponivel"'), "depois da disponibilidade, no texto");
});

test("E643: a marca é texto simples, sem pílula branca nem posição absoluta sobre a foto", () => {
  assert.doesNotMatch(marca, /rounded-full|bg-white|absolute/);
  assert.match(marca, /data-testid="marca-imovel"/);
});

test("E643: a foto continua com no máximo 2 pílulas (E626)", () => {
  const selos = readFileSync("src/lib/cartao-selos-foto.ts", "utf8");
  assert.match(selos, /\(s\.nivel \? 1 : 0\) \+ \(s\.simbolos\.length > 0 \? 1 : 0\)/);
});
