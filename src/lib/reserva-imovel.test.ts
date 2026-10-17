/*
  Coluna de reserva do imóvel (ordem 4f8023d1).
  Roda: node --test src/lib/reserva-imovel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBRL } from "./utils.ts";
import { destinoWhatsappViva, linhasDeTaxas, mensagemWhatsappViva, numeroWhatsappViva, resumoSolicitacao } from "./reserva-imovel.ts";

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

test("WhatsApp: rótulo só promete WhatsApp quando há número da Viva", () => {
  assert.equal(destinoWhatsappViva("ube-001", "5534999990000").rotulo, "WhatsApp da Viva");
  for (const n of [undefined, "", "abc"]) assert.equal(destinoWhatsappViva("ube-001", n).rotulo, "Falar com a Viva");
});

test("solicitação: resumo com entrada, motivo e valores", () => {
  const r = resumoSolicitacao({ monthlyPrice: 2500, inicioDesejado: "2026-11-01", motivoEstadia: "trabalho_remoto", hoje: "2026-10-16" });
  assert.equal(r.erro, null);
  const v = (k: string) => r.linhas.find((l) => l.rotulo === k)!.valor;
  assert.equal(v("Entrada"), "01/11/2026");
  assert.equal(v("Motivo da estadia"), "Trabalho remoto");
  assert.equal(v("Valor por mês"), formatBRL(2500));
  assert.match(v("Caução"), /devolvida no fim/);
});

test("solicitação: com pacote de limpeza, o total do mês soma 2.400 + 350 + 200 + 180 = 3.130 (ordem 87aabd61)", () => {
  const total = 2400 + 350 + 200 + 180;
  const r = resumoSolicitacao({ monthlyPrice: 2400, hoje: "2026-10-16", limpezaEstadia: { porMes: 2, inclui: "", valorMes: 180 }, totalMensal: total });
  assert.equal(total, 3130);
  assert.equal(r.linhas.find((l) => l.rotulo === "Total por mês")!.valor, formatBRL(3130));
  assert.ok(r.linhas.some((l) => l.rotulo === "Limpeza durante a estadia"));
  assert.equal(resumoSolicitacao({ monthlyPrice: 2400, hoje: "2026-10-16" }).linhas.some((l) => l.rotulo === "Total por mês"), false);
});

test("solicitação: campos opcionais vazios seguem; data no passado, data torta e motivo fora da lista são recusados", () => {
  const ok = resumoSolicitacao({ monthlyPrice: 1000, hoje: "2026-10-16" });
  assert.equal(ok.erro, null);
  assert.equal(ok.linhas[0].valor, "A combinar com o proprietário");
  assert.equal(resumoSolicitacao({ monthlyPrice: 1000, inicioDesejado: "2026-10-15", hoje: "2026-10-16" }).erro?.includes("hoje ou depois"), true);
  assert.equal(resumoSolicitacao({ monthlyPrice: 1000, inicioDesejado: "amanhã", hoje: "2026-10-16" }).erro?.includes("hoje ou depois"), true);
  assert.ok(resumoSolicitacao({ monthlyPrice: 1000, motivoEstadia: "hackeado", hoje: "2026-10-16" }).erro);
  assert.equal(resumoSolicitacao({ monthlyPrice: 1000, inicioDesejado: "2026-10-16", hoje: "2026-10-16" }).erro, null);
});

test("pacote de limpeza (ordem 4c74ac38): linha própria na proposta e no cartão, com a quantidade", () => {
  const pacote = { porMes: 2, inclui: "Pisos e banheiro", valorMes: 180 };
  const l = linhasDeTaxas({ ...base, limpezaEstadia: pacote });
  assert.deepEqual(l.map((x) => x.chave), ["mensal", "limpeza", "caucao", "viva"]);
  assert.match(l.find((x) => x.chave === "limpeza")!.rotulo, /2 limpezas por mês/);
  assert.ok(!linhasDeTaxas(base).some((x) => x.chave === "limpeza"));

  const r = resumoSolicitacao({ monthlyPrice: 2500, hoje: "2026-10-16", limpezaEstadia: pacote });
  const linha = r.linhas.find((x) => x.rotulo === "Limpeza durante a estadia");
  assert.match(linha!.valor, /2 limpezas por mês/);
  assert.ok(!resumoSolicitacao({ monthlyPrice: 2500, hoje: "2026-10-16" }).linhas.some((x) => x.rotulo === "Limpeza durante a estadia"));
});

test("pacote pago: linha da proposta traz o valor e o resumo mostra o total por mês (ordem 87aabd61)", () => {
  const pago = linhasDeTaxas({ ...base, limpezaEstadia: { porMes: 2, inclui: "", valorMes: 180 } }).find((x) => x.chave === "limpeza")!;
  assert.equal(pago.valor, formatBRL(180));
  const incl = linhasDeTaxas({ ...base, limpezaEstadia: { porMes: 1, inclui: "", valorMes: 0 } }).find((x) => x.chave === "limpeza")!;
  assert.equal(incl.valor, undefined);
  const r = resumoSolicitacao({ monthlyPrice: 2400, hoje: "2026-10-16", totalMensal: 3130 });
  assert.equal(r.linhas.find((x) => x.rotulo === "Total por mês")!.valor, formatBRL(3130));
  assert.ok(!resumoSolicitacao({ monthlyPrice: 2400, hoje: "2026-10-16" }).linhas.some((x) => x.rotulo === "Total por mês"));
});
