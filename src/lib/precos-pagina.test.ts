/* Roda: node --test src/lib/precos-pagina.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DESTAQUES_PRECOS, FRASES_REGRA, INCLUIDO_CONTRATO, OPCIONAIS_PRECOS, SUBTITULO_OPCIONAIS, cartoesCompare } from "./precos-pagina.ts";
import { FAIXAS_COMISSAO_PADRAO, TAXA_COMISSAO_PADRAO, pctTexto } from "./cobranca/regra.ts";
import { achadosNoTexto } from "./varredura-texto.ts";

test("prompt 13: toda grade de caixas da página tem número PAR", () => {
  for (const [nome, n] of [
    ["destaques", DESTAQUES_PRECOS.length],
    ["incluído", INCLUIDO_CONTRATO.length],
    ["opcionais", OPCIONAIS_PRECOS("x").length],
    ["compare", cartoesCompare().length],
  ] as const) {
    assert.equal(n % 2, 0, `${nome}: ${n}`);
    assert.equal(n, 4, nome);
  }
});

test("prompt 13: destaques vêm de regra.ts (12% e até 6%), sem número solto", () => {
  const textos = DESTAQUES_PRECOS.map((d) => `${d.n} ${d.t}`);
  assert.ok(textos.includes(`${pctTexto(TAXA_COMISSAO_PADRAO)} só com contrato fechado`));
  assert.ok(textos.includes(`até ${pctTexto(Math.min(...FAIXAS_COMISSAO_PADRAO.map((f) => f.taxa)))} com mais imóveis`));
  assert.deepEqual(textos.filter((t) => t.startsWith("R$ 0")), ["R$ 0 para anunciar", "R$ 0 para quem vem morar"]);
  assert.equal(FRASES_REGRA.length, 3);
});

test("prompt 13: Compare = Viva, Airbnb, Booking.com e anúncio por conta própria; sem QuintoAndar; % só com fonte", () => {
  const c = cartoesCompare();
  assert.deepEqual(c.map((x) => x.id), ["viva", "airbnb", "booking", "proprio"]);
  assert.ok(!c.some((x) => /quintoandar/i.test(x.nome)));
  for (const x of c.filter((x) => x.id !== "viva")) {
    if (x.pct !== null) assert.ok(x.fonte?.url.startsWith("https://") && x.conferidoEm, `${x.nome}: % sem fonte`);
  }
  const booking = c.find((x) => x.id === "booking")!;
  assert.equal(booking.pct, null, "Booking sem página oficial com o % para o Brasil: não mostra número");
  assert.match(booking.regra, /varia por contrato/);
});

test("prompt 13: vocabulário (sem inquilino, locação, aluguel, comissão) e Caução com a constante", () => {
  const textos = [
    ...DESTAQUES_PRECOS.map((d) => d.t),
    ...FRASES_REGRA,
    ...INCLUIDO_CONTRATO.flatMap((b) => [b.titulo, b.texto]),
    ...OPCIONAIS_PRECOS("").flatMap((o) => [o.titulo, o.texto]),
    SUBTITULO_OPCIONAIS,
    ...cartoesCompare().filter((x) => x.id !== "viva" && x.id !== "airbnb").map((x) => x.regra),
  ];
  for (const t of textos) {
    assert.doesNotMatch(t, /inquilin|loca[çc][ãa]o|aluguel|comiss[ãa]o/i, t);
    assert.deepEqual(achadosNoTexto(t, { vocabulario: true }), [], t);
  }
  assert.match(SUBTITULO_OPCIONAIS, /entre proprietário e morador/);
  assert.match(OPCIONAIS_PRECOS("FRASE-DA-CONSTANTE")[0].texto, /^FRASE-DA-CONSTANTE /);
});
