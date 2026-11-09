/*
  Varredura de erros (rodada 20): três leituras que viravam um "não" falso em ações logadas.
  • Agenda do parceiro: falha ao ler não vira "agenda vazia" (pedido recusado como "fora da agenda") nem "fora da agenda" no horário proposto.
  • Instruções de entrada: falha ao ler não vira "instruções em branco" (o dono seria barrado ao assinar).
  • Consumo do código de assinatura: falha ao gravar não vira "código bloqueado".
  Roda: node --test src/lib/data/e293-leituras-r20.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("agenda do parceiro: lança na falha e os três chamadores mostram aviso próprio", () => {
  const s = ler("lib/parceiros/pedido-servidor.ts");
  assert.match(s, /const \{ data, error \} = await admin\.from\("parceiro_agenda"\)/);
  assert.match(s, /if \(error\) throw new Error\(MSG_AGENDA_SEM_LEITURA\)/);
  const a = ler("lib/parceiros/pedido-actions.ts");
  assert.equal((a.match(/if \(!agenda\) return \{ ok: false, erro: MSG_AGENDA_SEM_LEITURA \}/g) ?? []).length, 2);
  assert.match(ler("lib/automacao/servidor.ts"), /Não foi possível conferir a sua agenda agora/);
});

test("instruções de entrada: lança na falha e a assinatura (as duas ações) diz que não deu para conferir", () => {
  assert.match(ler("lib/checkin-servidor.ts"), /if \(error\) throw new Error\("Não foi possível conferir as instruções de entrada agora\."\)/);
  const c = ler("lib/data/contrato-assinar-actions.ts");
  assert.equal((c.match(/if \(preenchidas === null\) return \{ ok: false, error: MSG_ASSINATURA_SEM_LEITURA \}/g) ?? []).length, 2);
});

test("consumo do código de assinatura: erro de gravação não vira 'código bloqueado'", () => {
  const c = ler("lib/data/contrato-assinar-actions.ts");
  assert.match(c, /const \{ data: consumido, error: erroConsumo \} = await admin/);
  assert.ok(c.indexOf("if (erroConsumo)") < c.indexOf("if (!consumido?.length) return { ok: false, error: MSG_CODIGO_BLOQUEADO }"));
});
