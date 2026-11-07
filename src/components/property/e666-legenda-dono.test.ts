import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E666 (lado do dono): no calendário da edição do anúncio, "Ocupado" (estadia com contrato) e "Bloqueado" (fechado por
// ele ou vindo de outro site) são explicados na legenda, sem depender de ler o rótulo curto da grade.
const dono = readFileSync(new URL("./block-calendar.tsx", import.meta.url), "utf8");
const legenda = readFileSync(new URL("../calendario/calendario-mes.tsx", import.meta.url), "utf8");

test("a legenda aceita rótulos próprios por marca (a grade única continua a mesma)", () => {
  assert.match(legenda, /export function LegendaCalendario\(\{ marcas, rotulos \}/);
  assert.match(legenda, /rotulos\?\.\[m\] \?\? ROTULO_MARCA\[m\]/);
});

test("calendário do dono: 'Bloqueado por você ou de outro site' e a explicação Ocupado × Bloqueado", () => {
  assert.match(dono, /rotulos=\{\{ bloqueado: "Bloqueado por você ou de outro site" \}\}/);
  assert.match(dono, /data-testid="calendario-legenda-explicacao"/);
  assert.match(dono, /Ocupado: estadia com contrato/);
  assert.match(dono, /Bloqueado: dia que você fechou/);
});
