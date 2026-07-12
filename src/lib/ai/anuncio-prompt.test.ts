/*
  Testes dos guarda-corpos da geração de anúncio por IA (sem I/O).
  Roda com: node --experimental-strip-types --test src/lib/ai/anuncio-prompt.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { montarBrief, contemContato, limparSaida } from "./anuncio-prompt.ts";

test("montarBrief: allowlist estrita — descarta endereço/PII e campos vazios", () => {
  const brief = montarBrief({
    tipo: "apartamento",
    cidade: "Uberlândia",
    bairro: "Centro",
    quartos: "2",
    banheiros: 1,
    areaM2: 68,
    // campos que NUNCA podem ir ao modelo:
    rua: "Rua Coronel Fulano, 123",
    cep: "38400-000",
    ownerName: "Daniel Rodovalho",
    telefone: "34999998888",
  });
  assert.equal(brief.tipo, "apartamento");
  assert.equal(brief.quartos, 2); // string virou número
  assert.equal(brief.areaM2, 68);
  // Nada de endereço/PII no brief:
  assert.equal((brief as Record<string, unknown>).rua, undefined);
  assert.equal((brief as Record<string, unknown>).cep, undefined);
  assert.equal((brief as Record<string, unknown>).ownerName, undefined);
  assert.equal((brief as Record<string, unknown>).telefone, undefined);
});

test("montarBrief: comodidades limitadas a 12 e aparadas", () => {
  const brief = montarBrief({ comodidades: Array.from({ length: 20 }, (_, i) => `item ${i}`) });
  assert.equal(brief.comodidades?.length, 12);
});

test("montarBrief: número inválido/zero vira undefined", () => {
  const brief = montarBrief({ quartos: 0, banheiros: "abc", areaM2: -5 });
  assert.equal(brief.quartos, undefined);
  assert.equal(brief.banheiros, undefined);
  assert.equal(brief.areaM2, undefined);
});

test("contemContato: detecta telefone, e-mail e URL", () => {
  assert.equal(contemContato("Fale comigo: (34) 99999-8888"), true);
  assert.equal(contemContato("meu email é dono@exemplo.com"), true);
  assert.equal(contemContato("veja em www.meusite.com"), true);
  assert.equal(contemContato("Apartamento claro e mobiliado no Centro"), false);
});

test("limparSaida: remove contato que escapar para o texto", () => {
  const out = limparSaida("Apartamento no Centro. WhatsApp (34) 99999-8888 ou dono@x.com");
  assert.equal(contemContato(out), false);
  assert.ok(out.includes("Apartamento no Centro"));
});
