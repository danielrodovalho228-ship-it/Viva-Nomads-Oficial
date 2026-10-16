/* Roda: node --test src/lib/textos-pacote-1610.test.ts
   Guarda de texto — pacote do Otávio de 16/10 (#139 comparativo, #140 promessa de renda,
   #141 seguro incêndio e "verifica" no anúncio). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho: string) => readFileSync(new URL(`../../${caminho}`, import.meta.url), "utf8");
/** Texto visível aproximado: sem tags JSX e sem {" "}. */
const plano = (t: string) => t.replace(/\{" "\}/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

test("#139: comparativo da home não afirma que o Airbnb não faz estadia longa", () => {
  const t = ler("src/app/(public)/page.tsx");
  assert.doesNotMatch(t, /<CompareRow label="Estadia de 30 a 180 dias"/);
  assert.match(t, /<CompareRow label="Contrato de locação com assinatura digital"/);
});

test("#140: sem promessa de renda ('margem', 'anunciar mais caro')", () => {
  const home = ler("src/app/(public)/page.tsx");
  const prop = ler("src/app/(public)/para-proprietarios/page.tsx");
  for (const [nome, t] of [["home", home], ["para-proprietarios", prop]] as const) {
    assert.doesNotMatch(t, /margem/i, nome);
    assert.doesNotMatch(t, /anunciar mais caro/i, nome);
  }
  assert.match(plano(prop), /Seu imóvel mobiliado ocupado por meses, com contrato/);
  assert.match(plano(home), /Mais estabilidade e menos tempo com o imóvel parado/);
});

test("#141: seguro incêndio sai de 'Você fica protegido por' e anúncio não diz 'verifica'", () => {
  const cf = ler("src/app/(public)/como-funciona/page.tsx");
  const bloco = cf.slice(cf.indexOf("function ProtegidoPor"), cf.indexOf("function SubNav"));
  assert.doesNotMatch(bloco, /title: "Seguro incêndio"/);
  assert.doesNotMatch(bloco, /Obrigatório por lei/);
  assert.match(bloco, /Em breve: seguro incêndio via parceiro/);
  const anuncio = ler("src/components/property/stay-rules.tsx");
  assert.doesNotMatch(anuncio, /conecta,\s+verifica/);
  assert.match(anuncio, /confere a documentação do imóvel e registra a negociação, mas nunca recebe o dinheiro/);
});
