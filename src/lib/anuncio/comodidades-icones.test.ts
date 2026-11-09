import test from "node:test";
import assert from "node:assert/strict";
import { Check, Wifi, AirVent, Car } from "lucide-react";
import { iconeDaComodidade, ICONE_POR_CHAVE } from "./comodidades-icones.ts";
import { AMENITY_GROUPS } from "../amenities.ts";
import { LIMITE_PRINCIPAIS } from "./comodidades.ts";

test("toda comodidade do catálogo tem ícone próprio (não o genérico)", () => {
  for (const g of AMENITY_GROUPS) for (const it of g.items) {
    assert.ok(ICONE_POR_CHAVE[it.key], `sem ícone: ${it.key}`);
    assert.notEqual(iconeDaComodidade(it.label), Check, it.label);
  }
});

test("texto livre usa palavra-chave; sem par cai no ícone padrão", () => {
  assert.equal(iconeDaComodidade("Wi-Fi 500 mega"), Wifi);
  assert.equal(iconeDaComodidade("Ar-condicionado split"), AirVent);
  assert.equal(iconeDaComodidade("Vaga de garagem"), Car);
  assert.equal(iconeDaComodidade("Algo inédito"), Check);
});

test("as principais na página são em número par", () => {
  assert.equal(LIMITE_PRINCIPAIS % 2, 0);
});

test("conformidade 31/10: o Editar anúncio mostra as comodidades no cartão do cadastro, com o ícone de cada uma", async () => {
  const { readFileSync } = await import("node:fs");
  const c = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx", import.meta.url), "utf8");
  const secao = c.slice(c.indexOf('testid="secao-comodidades"'), c.indexOf("<SugestoesDasFotos"));
  assert.match(secao, /<CartaoEscolha[\s\S]*?icone=\{iconeDaComodidade\(it\.key\)\}/);
  assert.match(secao, /className="grade-par grid gap-2 sm:grid-cols-2" data-testid="editar-comodidades-grade"/);
  assert.doesNotMatch(secao, /rounded-full border px-3 py-2/, "a pílula sem ícone não volta");
});

test("conformidade (mockup cadastro-imovel-05): os cartões do Pronto para trabalhar também têm o ícone da comodidade", async () => {
  const { readFileSync } = await import("node:fs");
  const c = readFileSync(new URL("../../components/anuncio/blocos-cadastro.tsx", import.meta.url), "utf8");
  assert.match(c, /testid=\{`trabalho-\$\{it\.chave\}`\}[\s\S]{0,200}icone=\{iconeDaComodidade\(it\.chave\)\}/);
  const { ESSENCIAIS_TRABALHO, OPCIONAIS_TRABALHO } = await import("./sugestoes-cadastro.ts");
  for (const it of [...ESSENCIAIS_TRABALHO, ...OPCIONAIS_TRABALHO]) assert.ok(ICONE_POR_CHAVE[it.chave], `sem ícone: ${it.chave}`);
});

// Varredura de conformidade (09/11): "um ícone por comodidade" — nenhuma comodidade dos anúncios de exemplo cai no check genérico.
test("as comodidades dos anúncios de exemplo têm ícone próprio (Aceita pets, Acessível, Quintal)", async () => {
  const { Check } = await import("lucide-react");
  const { SAMPLE_PROPERTIES } = await import("../properties.ts");
  const sem = new Set<string>();
  for (const p of SAMPLE_PROPERTIES) for (const a of p.amenities ?? []) if (iconeDaComodidade(a) === Check) sem.add(a);
  assert.deepEqual([...sem], []);
});
