import test from "node:test";
import assert from "node:assert/strict";
import {
  QTDS_LIMPEZA,
  normalizarLimpezaEstadia,
  textoLimpezaEstadia,
  linhaLimpezaResumo,
  limpezaDoResumo,
} from "./limpeza-estadia.ts";

const boa = { porMes: 2, inclui: "Pisos, banheiro e cozinha", valorMes: 180 };

test("quantidades permitidas: 0, 1, 2 e 4", () => {
  assert.deepEqual([...QTDS_LIMPEZA], [0, 1, 2, 4]);
});

test("pacote válido é normalizado", () => {
  assert.deepEqual(normalizarLimpezaEstadia(boa), { porMes: 2, inclui: "Pisos, banheiro e cozinha", valorMes: 180 });
  assert.deepEqual(normalizarLimpezaEstadia({ porMes: "4", inclui: "  Tudo  ", valorMes: "99,5" }), {
    porMes: 4,
    inclui: "Tudo",
    valorMes: 99.5,
  });
});

test("zero limpezas, quantidade fora da lista ou dado inválido viram null", () => {
  assert.equal(normalizarLimpezaEstadia({ ...boa, porMes: 0 }), null);
  assert.equal(normalizarLimpezaEstadia({ ...boa, porMes: 3 }), null);
  assert.equal(normalizarLimpezaEstadia({ ...boa, valorMes: -1 }), null);
  assert.equal(normalizarLimpezaEstadia({ ...boa, valorMes: 100001 }), null);
  assert.equal(normalizarLimpezaEstadia({ ...boa, inclui: "x".repeat(201) }), null);
  assert.equal(normalizarLimpezaEstadia(null), null);
  assert.equal(normalizarLimpezaEstadia("2"), null);
});

test("valor 0 = limpezas já incluídas no valor mensal; texto de controle é limpo", () => {
  const r = normalizarLimpezaEstadia({ porMes: 1, inclui: "a\u0000b\n c", valorMes: 0 });
  assert.equal(r?.valorMes, 0);
  assert.equal(r?.inclui, "a b c");
});

test("texto do anúncio mostra a quantidade e o valor", () => {
  assert.equal(
    textoLimpezaEstadia({ porMes: 2, inclui: "Pisos e banheiro", valorMes: 180 }),
    "2 limpezas por mês (Pisos e banheiro) — R$ 180,00 por mês"
  );
  assert.equal(textoLimpezaEstadia({ porMes: 1, inclui: "", valorMes: 0 }), "1 limpeza por mês — incluída no valor mensal");
  assert.equal(textoLimpezaEstadia({ porMes: 4, inclui: "", valorMes: 0 }), "4 limpezas por mês — incluídas no valor mensal");
});

test("resumo do contrato traz a quantidade explícita", () => {
  assert.equal(
    linhaLimpezaResumo({ porMes: 2, inclui: "Pisos", valorMes: 180 }),
    "Limpeza durante a estadia — 2 limpezas por mês (Pisos) — R$ 180,00 por mês"
  );
});

test("limpezaDoResumo lê o pacote congelado; sem o dado, sem linha (contratos antigos)", () => {
  assert.equal(limpezaDoResumo({ algumaAssinatura: true, viva: boa, congelada: undefined }), null);
  assert.equal(limpezaDoResumo({ algumaAssinatura: true, viva: null, congelada: boa })?.porMes, 2);
  // antes da assinatura vale o anúncio ao vivo; depois, só o congelado (mesmo hash para as duas partes)
  assert.equal(limpezaDoResumo({ algumaAssinatura: false, viva: boa, congelada: null })?.porMes, 2);
  assert.equal(limpezaDoResumo({ algumaAssinatura: true, viva: boa, congelada: null }), null);
});
