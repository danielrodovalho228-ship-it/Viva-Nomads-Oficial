/*
  E440 — orçamento numerado ligado ao pedido do morador.
  O pedido (candidatura aceita) ganha o número público VN-PD-…, o morador pode "Pedir orçamento" pela plataforma
  (mensagem no chat com o número) e a tela do contrato VN-CT-… mostra o número do pedido e do orçamento (ORC-…).
  Sem migração e sem tocar no texto jurídico do ZapSign.
  Roda: node --test src/lib/data/e440-orcamento-numerado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  numeroPublicoPedido,
  linhaNumerosDoContrato,
  textoPedirOrcamento,
  podePedirOrcamento,
} from "../pedido-ref.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("número do pedido: VN-PD- + 8 primeiros do id, em maiúsculas; id inválido não vira número", () => {
  assert.equal(numeroPublicoPedido("d5d50247-aaaa-bbbb-cccc-111122223333"), "VN-PD-D5D50247");
  assert.equal(numeroPublicoPedido(null), null);
  assert.equal(numeroPublicoPedido(undefined), null);
  assert.equal(numeroPublicoPedido(""), null);
  assert.equal(numeroPublicoPedido("x; drop"), null);
});

test("linha do contrato: mostra o que existe e some quando não há nenhum número", () => {
  assert.equal(linhaNumerosDoContrato("VN-PD-AB12CD34", "ORC-2026-0007"), "Pedido do morador: VN-PD-AB12CD34 · Orçamento: ORC-2026-0007");
  assert.equal(linhaNumerosDoContrato("VN-PD-AB12CD34", null), "Pedido do morador: VN-PD-AB12CD34");
  assert.equal(linhaNumerosDoContrato(null, "ORC-2026-0007"), "Orçamento: ORC-2026-0007");
  assert.equal(linhaNumerosDoContrato(null, null), null);
});

test("pedir orçamento: só pedido aceito, sem orçamento aberto e sem contrato; a mensagem cita o número", () => {
  assert.equal(podePedirOrcamento({ situacao: "aceita", temOrcamentoAberto: false, temContrato: false }), true);
  assert.equal(podePedirOrcamento({ situacao: "em_analise", temOrcamentoAberto: false, temContrato: false }), false);
  assert.equal(podePedirOrcamento({ situacao: "aceita", temOrcamentoAberto: true, temContrato: false }), false);
  assert.equal(podePedirOrcamento({ situacao: "aceita", temOrcamentoAberto: false, temContrato: true }), false);
  assert.match(textoPedirOrcamento("VN-PD-AB12CD34"), /VN-PD-AB12CD34/);
});

test("ação no servidor: só o próprio morador, falha de leitura bloqueia (não passa por 'sem orçamento')", () => {
  const src = ler("./pedido-orcamento-actions.ts");
  assert.match(src, /^"use server";/);
  assert.match(src, /\.eq\("tenant_id", user\.id\)/);
  assert.match(src, /podePedirOrcamento\(/);
  assert.match(src, /sendMessage\(/);
  assert.match(src, /throw new Error\("Não foi possível ler os números do contrato agora\."\)/);
  assert.doesNotMatch(src, /zapsign/i, "não mexe no texto jurídico");
});

test("telas: candidatura aceita mostra o número e o botão; contrato mostra os números ou o erro de leitura", () => {
  const pagina = ler("../../app/(dashboard)/dashboard/candidaturas/page.tsx");
  assert.match(pagina, /<PedirOrcamento leadId=\{c\.id\}/);
  assert.match(pagina, /c\.situacao\.chave === "aceita" && !c\.contrato/);
  const contrato = ler("../../components/contrato/contrato-detalhe.tsx");
  assert.match(contrato, /numerosDoContrato\(c\.id\)/);
  assert.match(contrato, /data-testid="contrato-numeros"/);
  assert.match(contrato, /data-testid="contrato-numeros-falhou"/);
});
