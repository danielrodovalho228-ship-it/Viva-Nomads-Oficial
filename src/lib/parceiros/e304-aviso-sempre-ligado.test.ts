import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ufsDaCidade, ufUnicaDaCidade } from "./indicacao.ts";

const MUN = { MG: ["Uberlândia", "Bom Jesus do Galho"], PI: ["Bom Jesus"], RS: ["Bom Jesus"], SC: ["Bom Jesus"] } as const;
const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E304: cidade ambígua oferece só os estados que têm essa cidade", () => {
  assert.equal(ufUnicaDaCidade("Bom Jesus", MUN), null);
  assert.deepEqual(ufsDaCidade("Bom Jesus", MUN), ["PI", "RS", "SC"]);
  assert.deepEqual(ufsDaCidade("uberlandia", MUN), ["MG"]);
  assert.deepEqual(ufsDaCidade("", MUN), []);
});

test("E304: o cartão vazio sempre tem o aviso com botão — com cidade OU só com categoria", () => {
  const vazia = ler("components/parceiros/busca-vazia.tsx");
  assert.doesNotMatch(vazia, /aviso-informar-cidade/, "o cartão sem botão de avisar saiu");
  assert.match(vazia, /pedirCidade=\{!cidade\}/);
  assert.match(vazia, /opcoesUf=\{opcoesUf\}/);
  const aviso = ler("app/(public)/parceiros/fotografos/aviso-fotografo.tsx");
  // O botão só desliga enquanto envia (ou sem como escolher o estado, fora da busca de parceiros).
  assert.match(aviso, /disabled=\{enviando \|\| \(!ufLocal && !escolheLocal\)\}/);
  assert.match(aviso, /data-testid="aviso-uf"/);
  assert.match(aviso, /data-testid="aviso-cidade"/);
  // "Indique um profissional" indica (link do pedido de parceria), não abre /parceiros.
  assert.match(vazia, /<IndicarProfissional categoria=\{categoria\} \/>/);
});
