import { test } from "node:test";
import assert from "node:assert/strict";
import { validarInicioEstadia, INICIO_MAX_DIAS_A_FRENTE } from "./inicio-estadia.ts";

const HOJE = "2026-10-15";

test("data de início: hoje e dia futuro valem", () => {
  assert.deepEqual(validarInicioEstadia("2026-10-15", HOJE), { ok: true });
  assert.deepEqual(validarInicioEstadia("2026-11-01", HOJE), { ok: true });
});

test("data de início: passado, vazio e formato torto são recusados", () => {
  for (const v of ["2026-10-14", "", "01/11/2026", "2026-13-40", "2026-02-30", undefined, null]) {
    const r = validarInicioEstadia(v as string, HOJE);
    assert.equal(r.ok, false, String(v));
  }
});

test("data de início: passado tem mensagem própria", () => {
  const r = validarInicioEstadia("2026-10-01", HOJE);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /passad/i);
});

test("data de início: não aceita daqui a mais de um ano", () => {
  assert.equal(INICIO_MAX_DIAS_A_FRENTE, 365);
  assert.equal(validarInicioEstadia("2027-10-15", HOJE).ok, true);
  assert.equal(validarInicioEstadia("2027-10-16", HOJE).ok, false);
});

test("F37: servidor e tela usam a mesma validação e os blocos não nascem mais com a data de hoje fixa", async () => {
  const { readFileSync } = await import("node:fs");
  const servidor = readFileSync(new URL("./data/actions.ts", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
  assert.match(servidor, /validarInicioEstadia\(input\.inicioISO, hojeBR\(\)\)/);
  assert.match(tela, /data-testid="inicio-estadia"/);
  assert.doesNotMatch(tela, /const inicioISO = hojeBR\(\)/);
  assert.match(tela, /Início da estadia/);
});

test("F37: o bloco 1 começa na data escolhida e a data aparece no cartão do contrato", async () => {
  const { encadearDatas } = await import("./contrato-blocos.ts");
  const blocos = encadearDatas("2026-11-20", [{ numero: 1, meses: 3, valor: 9000, caucao: 3000 }] as never);
  assert.equal(blocos[0].inicio, "2026-11-20");
  const { readFileSync } = await import("node:fs");
  const cartao = readFileSync(new URL("../app/(dashboard)/dashboard/contratos/contratos-client.tsx", import.meta.url), "utf8");
  assert.match(cartao, /data-testid="contrato-inicio"/);
  assert.match(cartao, /Início da estadia: \{formatDate\(contrato\.blocos\[0\]\.inicio\)\}/);
  const detalhe = readFileSync(new URL("../components/contrato/contrato-detalhe.tsx", import.meta.url), "utf8");
  assert.match(detalhe, /data-testid="contrato-inicio-estadia"/);
  const leitura = readFileSync(new URL("./data/contrato-assinar-actions.ts", import.meta.url), "utf8");
  assert.match(leitura, /inicioEstadia: inicio,/);
});
