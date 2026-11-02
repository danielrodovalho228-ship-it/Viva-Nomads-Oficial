/*
  Varredura ampliada (funções internas) — registrarRecebimento do webhook do Asaas (médio): o livro de recebimentos
  (0071) resolve o dono e o plano (assinatura) ou a candidatura (comissão) antes de gravar. As duas leituras não
  conferiam o erro: na falha, o recebimento era gravado SEM dono, plano ou candidatura — e como o upsert ignora o
  payment_id repetido, o reenvio do Asaas não corrigia nunca. Agora a leitura que falha LANÇA: processarAvisoAsaas
  desfaz o registro do evento e responde 500, e o Asaas reenvia o aviso mais tarde, quando a leitura volta.
  Roda: node --test src/lib/payments/residuo-recebimento-asaas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { processarAvisoAsaas } from "./asaas-webhook.ts";

const rota = readFileSync(new URL("../../app/api/webhooks/asaas/route.ts", import.meta.url), "utf8");
const fn = rota.slice(rota.indexOf("async registrarRecebimento(r)"), rota.indexOf("const r = await processarAvisoAsaas"));

test("as leituras do dono/plano e da candidatura lançam na falha (nunca recebimento sem dono)", () => {
  assert.match(fn, /const \{ data, error: erroAssinatura \} = await admin\s*\.from\("subscriptions"\)/);
  assert.match(fn, /if \(erroAssinatura\) throw new Error\(/);
  assert.match(fn, /const \{ data, error: erroCobranca \} = await admin\s*\.from\("cobrancas_fechamento"\)/);
  assert.match(fn, /if \(erroCobranca\) throw new Error\(/);
  assert.ok(fn.indexOf("if (erroAssinatura) throw") < fn.indexOf('.from("recebimentos").upsert('));
});

test("se registrarRecebimento lança, o evento é desfeito e o aviso volta como falha (o Asaas reenvia)", async () => {
  const log: string[] = [];
  const r = await processarAvisoAsaas(
    { event: "PAYMENT_RECEIVED", payment: { id: "pay_1", subscription: "sub_1", value: 99, paymentDate: "2026-11-02", dueDate: "2026-11-02" } } as never,
    {
      registrarEvento: async () => true,
      desfazerEvento: async (c: string) => void log.push(`desfez:${c}`),
      atualizarAssinatura: async () => true,
      atualizarCobranca: async () => true,
      registrarRecebimento: async () => {
        throw new Error("Não foi possível ler a assinatura.");
      },
    } as never,
  );
  assert.equal(r.ok, false);
  assert.deepEqual(log, ["desfez:pay_1:PAYMENT_RECEIVED"]);
});
