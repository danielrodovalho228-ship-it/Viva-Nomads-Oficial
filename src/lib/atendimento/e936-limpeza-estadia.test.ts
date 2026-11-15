/*
  E936 (decisão do coordenador, 15/11) — quem recebe o pacote de limpezas da estadia é o PROPRIETÁRIO: oferta dele no
  editor do anúncio, paga a ele junto com o valor mensal, direto; fora da taxa de serviço da Viva (calculada só sobre o
  valor mensal) e fora da taxa da área de Parceiros. O artigo da Ajuda diz isso palavra por palavra.
  Roda: node --test src/lib/atendimento/e936-limpeza-estadia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { FAQ } from "./faq.ts";
import { taxaServicoProposta, type TermosProposta } from "../propostas/regras.ts";

const TEXTO =
  "Sim, é opcional. No editor do anúncio você escolhe quantas limpezas por mês (1, 2 ou 4), o que cada uma inclui e o valor do pacote por mês. O pacote é seu: você organiza a limpeza com quem quiser, e o valor do pacote é pago a você junto com o valor mensal, direto, sem passar pela Viva. Se houver valor, ele entra no total por mês que o morador vê no anúncio, na busca e no contrato; com valor zero, aparece como incluída no valor mensal. O pacote não entra na conta da taxa de serviço da Viva, que é calculada sobre o valor mensal, e a taxa da área de Parceiros não se aplica a ele: ela vale só quando você contrata um serviço por lá.";

const BASE: TermosProposta = {
  valorBase: 3200, descontoPct: 0, descontoValor: 0, motivoDesconto: null, descontoEstadiaPct: 0, meses: 4,
  dataEntrada: "2026-11-01", condominio: 0, consumo: 0, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, limpezaUnica: 0,
};

test("E936: o artigo 'limpeza-estadia' é o texto do coordenador, palavra por palavra, e não diz 'comissão'", () => {
  const a = FAQ.find((p) => p.id === "limpeza-estadia");
  assert.ok(a);
  assert.equal(a.resposta, TEXTO);
  assert.doesNotMatch(a.resposta, /comiss[ãa]o/i);
});

test("E936: a taxa de serviço é a mesma com e sem pacote de limpeza (só o valor mensal entra)", () => {
  for (const taxa of [0.12, 0.08, 0.04]) {
    const sem = taxaServicoProposta(BASE, taxa);
    const com = taxaServicoProposta({ ...BASE, limpezasMes: 4, valorLimpeza: 150, limpezaUnica: 300 }, taxa);
    assert.equal(com, sem, `taxa ${taxa}`);
    assert.ok(sem > 0);
  }
});
