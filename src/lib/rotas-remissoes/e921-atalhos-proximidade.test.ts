import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GUIAS } from "../guias/guias.ts";
import { valorDaPilula } from "../busca/pilulas.ts";
import { FILTROS_PAINEL_VAZIOS } from "../busca/painel-filtros.ts";
import { TEMAS_AJUDA } from "../ajuda/temas.ts";
import { rotaViva } from "./rotas-vivas.ts";

/*
  E921 (Phoenix A-244–A-246): no guia de bairro, os atalhos de proximidade eram TEXTO não clicável e diziam que "já
  filtram os imóveis por proximidade" — mas o destino (HC-UFU, Umuarama) só REORDENA a busca (15/15 continuam). Escolha:
  o texto diz exatamente o que cada coisa faz e todo atalho visível é link. Na busca, a pílula do destino diz "Por tempo
  até X" (ordena); só com "até N min" ela filtra e diz "Até N min de X".
*/
const guia = GUIAS.find((g) => g.slug === "como-escolher-bairro-em-uberlandia")!;
const temas = TEMAS_AJUDA.map((t) => t.id);

test("o guia de bairro não promete filtro que não existe", () => {
  const texto = guia.secoes.flatMap((s) => s.paragrafos).join(" ");
  assert.doesNotMatch(texto, /filtram os imóveis por proximidade/);
  assert.match(texto, /ordem de tempo/);
});

test("todo atalho do guia é link para uma rota viva, e a página do guia desenha os atalhos como <Link>", () => {
  const atalhos = guia.secoes.flatMap((s) => s.atalhos ?? []);
  assert.ok(atalhos.length >= 2, "os atalhos de proximidade existem como links");
  for (const a of atalhos) assert.equal(rotaViva(a.href, temas), true, `${a.rotulo} → ${a.href}`);
  const pagina = readFileSync("src/app/(public)/guias/[slug]/page.tsx", "utf8");
  assert.match(pagina, /s\.atalhos\?\.map[\s\S]{0,300}<Link[^>]*href=\{a\.href\}/);
});

test("pílula do destino: sem tempo máximo ordena ('Por tempo até'); com tempo máximo filtra ('Até N min de')", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS };
  assert.equal(valorDaPilula("local", f, { local: "Uberlândia", perto: "HC-UFU" }), "Por tempo até HC-UFU");
  assert.equal(valorDaPilula("local", f, { local: "Uberlândia", perto: "HC-UFU", ateMin: 20 }), "Até 20 min de HC-UFU");
  assert.equal(valorDaPilula("local", f, { local: "Uberlândia" }), "Uberlândia");
});

test("a busca passa o tempo máximo do destino para a pílula", () => {
  const busca = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
  assert.match(busca, /ateMin=\{estadoDestino\.ate\}/);
  const barra = readFileSync("src/components/busca/barra-pilulas.tsx", "utf8");
  assert.match(barra, /ateMin: p\.ateMin/);
});
