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
  assert.match(dono, /ROTULOS_DONO = \{ periodo: "Ocupado \(estadia com contrato\)", bloqueado: "Bloqueado por você ou de outro site" \}/);
  assert.match(dono, /<LegendaCalendario marcas=\{\["periodo", "bloqueado", "selecionado", "hoje"\]\} rotulos=\{ROTULOS_DONO\}/);
  assert.match(dono, /data-testid="calendario-legenda-explicacao"/);
  assert.match(dono, /Ocupado: estadia com contrato\./);
  assert.match(dono, /Bloqueado: dia que você fechou/);
});

test("cada dia de estadia com contrato é marcado 'Ocupado' na grade do dono, separado do 'Bloqueado' (e lido assim pelo leitor de tela)", () => {
  assert.match(dono, /for \(const e of estadias\) for \(const d of diasDoIntervalo\(e\.inicio\.slice\(0, 10\), e\.fim\.slice\(0, 10\)\)\) marcasDoMes\[d\] = \[\.\.\.\(marcasDoMes\[d\] \?\? \[\]\), "periodo"\]/);
  assert.match(dono, /rotulos=\{ROTULOS_DONO\}\s+desabilitado/);
  assert.match(readFileSync(new URL("../calendario/calendario-mes.tsx", import.meta.url), "utf8"), /p\.rotulos\?\.\[m\] \?\? ROTULO_MARCA\[m\]/);
});
