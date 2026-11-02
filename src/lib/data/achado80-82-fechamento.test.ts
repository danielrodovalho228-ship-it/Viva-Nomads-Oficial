/*
  Varredura de erros e estados vazios (rodada 15) — dinheiro: leitura que falha nunca vira "taxa R$ 0", "registre o
  contrato antes" nem "em andamento".
  Achado 80: taxaDosContratosDoDono engolia o erro → contratos do dono com taxa R$ 0 / 0%.
  Achado 81: comissaoDoContrato engolia o erro → "Registre o contrato antes de gerar a cobrança" (409) com contrato registrado.
  Achado 82: lerReservaFechamento engolia o erro → a cobrança/contrato já gerado aparecia como "em andamento".
  Roda: node --test src/lib/data/achado80-82-fechamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("achado 80: a taxa dos contratos lança; com exigir, as telas mostram o aviso de Tentar de novo", () => {
  const t = ler("src/lib/data/taxa-dono-servidor.ts");
  const fn = t.slice(t.indexOf("export async function taxaDosContratosDoDono"), t.indexOf("export interface TaxaDoLead"));
  assert.match(fn, /const \{ data, error \} = await admin/);
  assert.match(fn, /if \(error\) throw new Error/);
  const c = ler("src/lib/data/contratos-actions.ts");
  assert.match(c, /\.catch\(\(e: unknown\) => \{\s*if \(opcoes\.exigir\) throw new Error\(MSG_CONTRATOS_NAO_CARREGARAM, \{ cause: e \}\);/);
});

test("achados 81 e 82: comissão e reserva lançam; as rotas respondem 503 antes de reservar ou cobrar", () => {
  const f = ler("src/lib/data/fechamento-servidor.ts");
  assert.equal((f.match(/if \(error\) throw new Error\(MSG_FECHAMENTO_SEM_LEITURA\);/g) ?? []).length, 2);
  const com = ler("src/app/api/comissao/route.ts");
  assert.match(com, /if \(contrato === "falhou"\) return NextResponse\.json\(\{ error: MSG_FECHAMENTO_SEM_LEITURA \}, \{ status: 503 \}\);/);
  assert.match(com, /if \(reserva === "falhou"\) return NextResponse\.json\(\{ error: MSG_FECHAMENTO_SEM_LEITURA \}, \{ status: 503 \}\);/);
  assert.ok(com.indexOf('reserva === "falhou"') < com.indexOf("reservarFechamento(f.leadId"));
  const ctr = ler("src/app/api/contrato/route.ts");
  assert.match(ctr, /if \(reserva === "falhou"\) return NextResponse\.json\(\{ error: MSG_FECHAMENTO_SEM_LEITURA \}, \{ status: 503 \}\);/);
  assert.ok(ctr.indexOf('reserva === "falhou"') < ctr.indexOf("decidirGeracaoContrato("));
});
