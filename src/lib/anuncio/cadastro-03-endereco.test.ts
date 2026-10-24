/*
  Cadastro 03: Endereço (mockup cadastro-imovel-03). Roda: node --test src/lib/anuncio/cadastro-03-endereco.test.ts
  - com rua, número, bairro e cidade: "Endereço completo" numa linha, "Mapa do bairro" (área aproximada, geocodificada só
    com bairro e cidade), o aviso de privacidade embaixo do mapa, "Confira…" e as etiquetas do bairro e da cidade;
  - faltando algum, só o aviso de privacidade.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const resumo = ler("app/(dashboard)/dashboard/imoveis/novo/resumo-endereco.tsx");
const etapa = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-onde-fica.tsx");

// As duas funções puras, reescritas do arquivo (o .tsx não roda no node --test).
function extrair(nome: string): string {
  const i = resumo.indexOf(`export function ${nome}`);
  assert.ok(i >= 0, nome);
  return resumo.slice(i, resumo.indexOf("\n}\n", i) + 2);
}

test("a linha do endereço junta rua, número, complemento, bairro, cidade e UF; o que falta sai", () => {
  const corpo = extrair("linhaEndereco");
  assert.match(corpo, /\[e\.rua\.trim\(\), e\.numero\.trim\(\), e\.complemento\?\.trim\(\)\]\.filter\(Boolean\)\.join\(", "\)/);
  assert.match(corpo, /\[e\.cidade\.trim\(\), e\.uf\?\.trim\(\)\]\.filter\(Boolean\)\.join\(" – "\)/);
  assert.match(corpo, /\[ruaNumero, lugar\]\.filter\(Boolean\)\.join\(" – "\)/);
});

test("o resumo só aparece com rua, número, bairro e cidade", () => {
  assert.match(extrair("enderecoCompletoParaResumo"), /\[e\.rua, e\.numero, e\.bairro, e\.cidade\]\.every\(\(v\) => v\.trim\(\)\.length > 0\)/);
  assert.match(etapa, /enderecoCompletoParaResumo\(\{ rua: p\.street, numero: p\.numero, bairro: p\.neighborhood, cidade: p\.city \}\) \?/);
  // Sem o endereço completo, fica só o aviso de privacidade (o mesmo, uma vez só no código).
  assert.equal((etapa.match(/NUNCA aparecem no anúncio público/g) ?? []).length, 1);
  assert.match(etapa, /\) : \(\s*avisoPrivacidade\s*\)\}/);
});

test("o mapa é do bairro: só bairro e cidade vão para a geocodificação, e a área é aproximada", () => {
  assert.match(resumo, /geocodeForSave\(\{ neighborhood: p\.bairro, city: p\.cidade \}\)/);
  assert.doesNotMatch(resumo, /geocodeForSave\(\{[^}]*street/);
  assert.match(resumo, /<PropertyMap [^>]*approximate/);
});

test("ordem do mockup: endereço, mapa, aviso, confira, etiquetas — e textos sem vocabulário proibido", () => {
  const i = (s: string) => {
    const n = resumo.indexOf(s);
    assert.ok(n >= 0, s);
    return n;
  };
  assert.ok(i('data-testid="endereco-resumo"') < i('data-testid="mapa-bairro"'));
  assert.ok(i('data-testid="mapa-bairro"') < i("{p.aviso}"));
  assert.ok(i("{p.aviso}") < i('data-testid="endereco-confira"'));
  assert.ok(i('data-testid="endereco-confira"') < i('data-testid="endereco-etiquetas"'));
  assert.match(resumo, /Endereço completo/);
  assert.match(resumo, /Mapa do bairro/);
  assert.match(resumo, /Confira se o endereço está certo antes de continuar\./);
  for (const t of [resumo, etapa]) assert.doesNotMatch(t, /h[oó]spede|reserva|temporada|check-in/i);
});
