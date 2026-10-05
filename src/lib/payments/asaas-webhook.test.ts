/*
  Webhook do Asaas: assinatura ativa/vencida, comissão paga/vencida e
  idempotência por (payment.id, evento).
  Roda: node --test src/lib/payments/asaas-webhook.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { processarAvisoAsaas, fimDoPeriodo, valorPago, type RepoAsaas, type Recebimento } from "./asaas-webhook.ts";

function repoFalso(opts: { assinaturas?: string[]; cobrancas?: string[]; falhar?: boolean; falharRecebimento?: boolean } = {}) {
  const eventos = new Set<string>();
  const recebimentos = new Map<string, Recebimento>();
  const assinaturas = new Map<string, Record<string, unknown>>((opts.assinaturas ?? []).map((s) => [s, {}]));
  const cobrancas = new Map<string, Record<string, unknown>>((opts.cobrancas ?? []).map((c) => [c, {}]));
  const repo: RepoAsaas = {
    async registrarEvento(chave) {
      if (eventos.has(chave)) return false;
      eventos.add(chave);
      return true;
    },
    async desfazerEvento(chave) {
      eventos.delete(chave);
    },
    async atualizarAssinatura(id, dados) {
      if (opts.falhar) throw new Error("banco fora");
      if (!assinaturas.has(id)) return false;
      assinaturas.set(id, { ...assinaturas.get(id), ...dados });
      return true;
    },
    async atualizarCobranca(id, dados) {
      if (opts.falhar) throw new Error("banco fora");
      if (!cobrancas.has(id)) return false;
      cobrancas.set(id, { ...cobrancas.get(id), ...dados });
      return true;
    },
    async registrarRecebimento(dados) {
      if (opts.falharRecebimento) throw new Error("livro fora");
      if (!recebimentos.has(dados.paymentId)) recebimentos.set(dados.paymentId, dados); // único por pagamento
    },
  };
  return { repo, eventos, assinaturas, cobrancas, recebimentos };
}

const AGORA = new Date("2026-10-04T12:00:00Z");

test("pagamento confirmado de assinatura ativa o plano até 1 mês após o vencimento", async () => {
  const f = repoFalso({ assinaturas: ["sub_1"] });
  const r = await processarAvisoAsaas(
    { event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", subscription: "sub_1", dueDate: "2026-10-05" } },
    f.repo,
    AGORA
  );
  assert.deepEqual(r, { ok: true, acao: "assinatura" });
  assert.equal(f.assinaturas.get("sub_1")?.status, "active");
  assert.equal(f.assinaturas.get("sub_1")?.current_period_end, "2026-11-05T23:59:59.000Z");
});

test("pagamento vencido de assinatura marca overdue", async () => {
  const f = repoFalso({ assinaturas: ["sub_1"] });
  await processarAvisoAsaas({ event: "PAYMENT_OVERDUE", payment: { id: "pay_2", subscription: "sub_1" } }, f.repo, AGORA);
  assert.equal(f.assinaturas.get("sub_1")?.status, "overdue");
});

test("pagamento avulso recebido marca a comissão de fechamento como paga", async () => {
  const f = repoFalso({ cobrancas: ["pay_9"] });
  const r = await processarAvisoAsaas(
    { event: "PAYMENT_RECEIVED", payment: { id: "pay_9", paymentDate: "2026-10-03" } },
    f.repo,
    AGORA
  );
  assert.deepEqual(r, { ok: true, acao: "cobranca" });
  assert.equal(f.cobrancas.get("pay_9")?.status, "pago");
  assert.equal(f.cobrancas.get("pay_9")?.pago_em, "2026-10-03T12:00:00Z");
});

test("comissão vencida", async () => {
  const f = repoFalso({ cobrancas: ["pay_9"] });
  await processarAvisoAsaas({ event: "PAYMENT_OVERDUE", payment: { id: "pay_9" } }, f.repo, AGORA);
  assert.equal(f.cobrancas.get("pay_9")?.status, "vencido");
});

test("o mesmo aviso reenviado não reprocessa (idempotência por payment.id + evento)", async () => {
  const f = repoFalso({ assinaturas: ["sub_1"] });
  const aviso = { event: "PAYMENT_RECEIVED", payment: { id: "pay_1", subscription: "sub_1", dueDate: "2026-10-05" } };
  await processarAvisoAsaas(aviso, f.repo, AGORA);
  f.assinaturas.set("sub_1", { status: "overdue" }); // mudou depois
  const r = await processarAvisoAsaas(aviso, f.repo, AGORA);
  assert.deepEqual(r, { ok: true, acao: "duplicado" });
  assert.equal(f.assinaturas.get("sub_1")?.status, "overdue");
});

test("falha no banco desfaz o registro para o Asaas reenviar", async () => {
  const f = repoFalso({ assinaturas: ["sub_1"], falhar: true });
  const r = await processarAvisoAsaas({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", subscription: "sub_1" } }, f.repo, AGORA);
  assert.equal(r.ok, false);
  assert.equal(f.eventos.size, 0);
});

test("evento não tratado é ignorado; aviso sem payment.id é erro", async () => {
  const f = repoFalso();
  assert.deepEqual(await processarAvisoAsaas({ event: "PAYMENT_CREATED", payment: { id: "x" } }, f.repo), {
    ok: true,
    acao: "ignorado",
  });
  assert.equal((await processarAvisoAsaas({ event: "PAYMENT_RECEIVED", payment: {} }, f.repo)).ok, false);
});

test("pagamento sem linha correspondente não quebra (sem_alvo)", async () => {
  const f = repoFalso();
  const r = await processarAvisoAsaas({ event: "PAYMENT_RECEIVED", payment: { id: "pay_x", subscription: "sub_x" } }, f.repo);
  assert.deepEqual(r, { ok: true, acao: "sem_alvo" });
});

test("fimDoPeriodo sem vencimento usa a data atual", () => {
  assert.equal(fimDoPeriodo(null, AGORA), "2026-11-04T12:00:00.000Z");
});

test("recebimento: assinatura paga entra no livro com valor; CONFIRMED + RECEIVED conta uma vez", async () => {
  const f = repoFalso({ assinaturas: ["sub_9"] });
  const pagamento = { id: "pay_9", subscription: "sub_9", dueDate: "2026-10-05", paymentDate: "2026-10-04", value: 49 };
  await processarAvisoAsaas({ event: "PAYMENT_CONFIRMED", payment: pagamento }, f.repo, AGORA);
  await processarAvisoAsaas({ event: "PAYMENT_RECEIVED", payment: pagamento }, f.repo, AGORA);
  assert.equal(f.recebimentos.size, 1);
  assert.deepEqual(f.recebimentos.get("pay_9"), {
    tipo: "assinatura",
    paymentId: "pay_9",
    subscriptionId: "sub_9",
    valor: 49,
    pagoEm: "2026-10-04T12:00:00Z",
  });
});

test("recebimento: comissão paga entra; vencida, sem valor ou sem alvo não entra", async () => {
  const f = repoFalso({ cobrancas: ["pay_c1", "pay_c2", "pay_c3"] });
  await processarAvisoAsaas({ event: "PAYMENT_RECEIVED", payment: { id: "pay_c1", value: "320.5" } }, f.repo, AGORA);
  await processarAvisoAsaas({ event: "PAYMENT_OVERDUE", payment: { id: "pay_c2", value: 100 } }, f.repo, AGORA);
  await processarAvisoAsaas({ event: "PAYMENT_RECEIVED", payment: { id: "pay_c3" } }, f.repo, AGORA);
  await processarAvisoAsaas({ event: "PAYMENT_RECEIVED", payment: { id: "pay_x", value: 10 } }, f.repo, AGORA);
  assert.deepEqual([...f.recebimentos.keys()], ["pay_c1"]);
  assert.equal(f.recebimentos.get("pay_c1")?.valor, 320.5);
  assert.equal(f.recebimentos.get("pay_c1")?.tipo, "comissao");
});

test("recebimento: falha no livro desfaz o aviso (o Asaas reenvia)", async () => {
  const f = repoFalso({ cobrancas: ["pay_f"], falharRecebimento: true });
  const r = await processarAvisoAsaas({ event: "PAYMENT_RECEIVED", payment: { id: "pay_f", value: 10 } }, f.repo, AGORA);
  assert.equal(r.ok, false);
  assert.equal(f.eventos.size, 0);
});

test("valorPago: só número positivo", () => {
  assert.equal(valorPago(49), 49);
  assert.equal(valorPago("12.345"), 12.35);
  assert.equal(valorPago(0), null);
  assert.equal(valorPago(-5), null);
  assert.equal(valorPago("abc"), null);
  assert.equal(valorPago(undefined), null);
});
