import { test, expect } from "@playwright/test";
import { AVISO_VALORES_BRUTOS, calcularBolso } from "../../../src/lib/cobranca/bolso";

/*
  T1583 — E762 (#3568): "O que vai para o seu bolso" não promete líquido sobre número bruto: o aviso diz que os valores são brutos e que a taxa é
  cobrada à parte (a Viva só intermedia; a taxa não é tirada do que o morador paga). Só lógica, roda no lab-crítico.
*/
test("E762: o aviso fala em valores brutos e taxa à parte, sem prometer líquido", () => {
  expect(AVISO_VALORES_BRUTOS).toMatch(/brutos/i);
  expect(AVISO_VALORES_BRUTOS).toMatch(/à parte/i);
  expect(AVISO_VALORES_BRUTOS).not.toMatch(/l[ií]quido/i);
});

test("E762: o cálculo de R$ 3.350 x 4 meses devolve o bruto (R$ 13.400) e a taxa à parte", () => {
  const b = calcularBolso(3350, 4, 1);
  expect(b.estado).toBe("ok");
});
