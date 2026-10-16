/*
  Coluna de reserva do imóvel (ordem 4f8023d1).
  Roda: node --test src/lib/reserva-imovel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBRL } from "./utils.ts";
import { destinoWhatsappViva, linhasDeTaxas, mensagemWhatsappViva, numeroWhatsappViva } from "./reserva-imovel.ts";

const base = { monthlyPrice: 3200 };

test("só valores informados pelo dono: sem taxa, só mensal + Caução + Viva R$ 0", () => {
  assert.deepEqual(linhasDeTaxas(base).map((x) => x.chave), ["mensal", "caucao", "viva"]);
});

test("itemiza limpeza de preparação, saída (só se ativa), condomínio, consumo fixo e pet", () => {
  const l = linhasDeTaxas({
    ...base, condoFee: 400, utilitiesMode: "fixed", utilitiesEstimate: 250, prepFee: 180,
    checkoutCleaningEnabled: true, checkoutCleaningFee: 120, petsAllowed: true,
    petsRegras: { valorPet: 300, valorPetTipo: "reembolsavel" },
  });
  assert.deepEqual(l.map((x) => x.chave), ["mensal", "condominio", "consumo", "preparacao", "saida", "pet", "caucao", "viva"]);
  assert.match(l.find((x) => x.chave === "pet")!.rotulo, /Caução pet/);
});

test("limpeza de saída desativada não aparece, mesmo com valor guardado", () => {
  const l = linhasDeTaxas({ ...base, checkoutCleaningEnabled: false, checkoutCleaningFee: 120 });
  assert.ok(!l.some((x) => x.chave === "saida"));
});

test("consumo medido e pet não aceito não viram linha (nada estimado)", () => {
  const l = linhasDeTaxas({ ...base, utilitiesMode: "metered", utilitiesEstimate: 250, petsAllowed: false, petsRegras: { valorPet: 300, valorPetTipo: "reembolsavel" } });
  assert.deepEqual(l.map((x) => x.chave), ["mensal", "caucao", "viva"]);
});

test("Caução é linha separada, sem valor inventado; taxa da Viva é R$ 0", () => {
  const l = linhasDeTaxas(base);
  const caucao = l.find((x) => x.chave === "caucao")!;
  assert.equal(caucao.valor, undefined);
  assert.match(caucao.nota!, /devolvida no fim/);
  assert.equal(l.find((x) => x.chave === "viva")!.valor, formatBRL(0));
});

test("WhatsApp: com número da Viva abre wa.me com o código do imóvel", () => {
  const d = destinoWhatsappViva("3f9a2c10-aaaa-bbbb-cccc-111122223333", "+55 (34) 99999-0000");
  assert.equal(d.externo, true);
  assert.ok(d.href.startsWith("https://wa.me/5534999990000?text="));
  assert.ok(decodeURIComponent(d.href).includes("VN-3F9A2C"));
});

test("WhatsApp: sem número configurado cai na Central de Ajuda, nunca em telefone de dono", () => {
  for (const n of [undefined, null, "", "abc", "123"]) {
    const d = destinoWhatsappViva("ube-001", n);
    assert.equal(d.externo, false);
    assert.ok(d.href.startsWith("/ajuda?imovel=VN-UBE001"));
    assert.ok(!d.href.includes("wa.me"));
  }
});

test("a mensagem cita só o código; número inválido é recusado", () => {
  assert.equal(mensagemWhatsappViva("ube-001"), "Olá, Viva! Tenho interesse no imóvel VN-UBE001.");
  assert.equal(numeroWhatsappViva("5534999990000"), "5534999990000");
  assert.equal(numeroWhatsappViva("34999990000"), null);
});
