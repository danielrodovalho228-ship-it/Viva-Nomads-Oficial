/*
  E826 — o mínimo de estadia que varia por anúncio aparece ANTES de abrir o anúncio: no cartão da busca ("mínimo de 60
  dias" no ube-003) e na promessa geral da home/rodapé, com a ressalva honesta. O filtro de estadia da busca já respeita
  o mínimo (cabeNaEstadia).
  Roda: node --test src/lib/e826-minimo-estadia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { MIN_DIAS_PROMESSA, itensSintese, textoMinimoDoAnuncio } from "./cartao-sintese.ts";
import { cabeNaEstadia } from "./busca/painel-filtros.ts";
import { PROMESSA_ESTADIA } from "../config/textos-regulados.ts";

const ler = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("o cartão mostra o mínimo de quem pede mais que 30 dias (ube-003: 60) e nada para quem segue a promessa", () => {
  assert.equal(MIN_DIAS_PROMESSA, 30);
  for (const p of SAMPLE_PROPERTIES) {
    const item = itensSintese(p).find((i) => i.chave === "minimo");
    if ((p.minPeriodDays ?? 30) > 30) assert.equal(item?.texto, `mínimo de ${p.minPeriodDays} dias`, p.id);
    else assert.equal(item, undefined, p.id);
  }
  const ube003 = SAMPLE_PROPERTIES.find((p) => p.id === "ube-003")!;
  assert.equal(ube003.minPeriodDays, 60);
  assert.ok(itensSintese(ube003).some((i) => i.texto === "mínimo de 60 dias"));
  assert.equal(textoMinimoDoAnuncio(30), null);
  assert.equal(textoMinimoDoAnuncio(null), null);
});

test("o filtro de estadia da busca já respeita o mínimo do anúncio", () => {
  assert.equal(cabeNaEstadia({ minPeriodDays: 60 }, 30), false);
  assert.equal(cabeNaEstadia({ minPeriodDays: 60 }, 60), true);
});

test("a promessa geral ganha a ressalva honesta (home e rodapé, pela frase única)", () => {
  assert.equal(PROMESSA_ESTADIA, "Estadias de 30 a 180 dias (alguns imóveis pedem mínimo maior)");
  assert.match(ler("app/(public)/page.tsx"), /\{PROMESSA_ESTADIA\} · sem taxa para o morador/);
  assert.doesNotMatch(ler("app/(public)/page.tsx"), /Estadias de 30 a 180 dias · sem taxa/);
  assert.match(ler("components/layout/footer.tsx"), /\{PROMESSA_ESTADIA\}\./);
});
