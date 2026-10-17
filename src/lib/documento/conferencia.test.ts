/*
  Conferência automática do documento (prompt 11). Roda: node --test src/lib/documento/conferencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  casoLabDoArquivo,
  decidirConferencia,
  dentroDaValidade,
  enderecoConfere,
  leituraSimulada,
  mascararCpfParcial,
  normalizarNumero,
  normalizarRua,
  sanearLeitura,
  statusDoEstado,
  type CadastroComparado,
  type LeituraDocumento,
} from "./conferencia.ts";

const HOJE = "2026-10-17";
const CAD: CadastroComparado = {
  nomeConta: "Maria Aparecida dos Santos Lima",
  endereco: { rua: "Rua Doutor João de Souza", numero: "102", bairro: "Centro", cidade: "Uberlândia", cep: "38400-100" },
  operacao: "own",
  duplicado: 0,
  hoje: HOJE,
};
const OK: LeituraDocumento = {
  tipo: "conta_consumo",
  titular: "MARIA APARECIDA S. LIMA",
  cpfCnpjParcial: "123456",
  endereco: { rua: "R. Dr. João Souza", numero: "102", bairro: "Centro", cidade: "Uberlandia", cep: "38400100" },
  dataDocumento: "2026-09-20",
  legivel: true,
  completo: true,
  sinaisDeEdicao: [],
  proprietariosListados: [],
  baixaConfianca: false,
};

test("normaliza rua (abreviação, acento, partícula) e número", () => {
  assert.equal(normalizarRua("R. Dr. João  de Souza"), "rua doutor joao souza");
  assert.equal(normalizarRua("Avenida Getúlio Vargas"), normalizarRua("Av Getulio Vargas"));
  assert.equal(normalizarNumero("120-A"), "120");
  assert.equal(normalizarNumero("s/n"), "");
  assert.equal(normalizarNumero("0102"), "102");
});

test("endereço: CEP igual OU rua + número iguais; número diferente no mesmo CEP não confere", () => {
  assert.ok(enderecoConfere({ cep: "38400100" }, CAD.endereco));
  assert.ok(enderecoConfere({ rua: "R. Dr. João Souza", numero: "102" }, { ...CAD.endereco, cep: "" }));
  assert.ok(!enderecoConfere({ cep: "38400100", numero: "120" }, CAD.endereco));
  assert.ok(!enderecoConfere({ rua: "Rua Outra", numero: "102" }, { ...CAD.endereco, cep: "" }));
});

test("validade por tipo: conta até 90 dias, IPTU do ano atual ou anterior, matrícula sem prazo", () => {
  assert.equal(dentroDaValidade("conta_consumo", "2026-07-20", HOJE), true);
  assert.equal(dentroDaValidade("conta_consumo", "2026-07-19", HOJE), true);
  assert.equal(dentroDaValidade("conta_consumo", "2026-07-18", HOJE), false);
  assert.equal(dentroDaValidade("iptu", "2025", HOJE), true);
  assert.equal(dentroDaValidade("iptu", "2024", HOJE), false);
  assert.equal(dentroDaValidade("matricula", null, HOJE), true);
  assert.equal(dentroDaValidade("conta_consumo", null, HOJE), null);
});

test("estado 1 — ok: aprovado automático com o checklist todo marcado", () => {
  const r = decidirConferencia(OK, CAD);
  assert.equal(r.estado, "aprovado");
  assert.deepEqual(r.checklist, { titular: true, imovel: true, legivel: true, validade: true });
  assert.equal(statusDoEstado(r.estado), "approved");
});

test("estado 2 — número diferente: Corrija com o detalhe", () => {
  const r = decidirConferencia({ ...OK, endereco: { ...OK.endereco, numero: "120" } }, CAD);
  assert.equal(r.estado, "corrija");
  assert.equal(r.motivos[0].texto, "O número do documento (120) não bate com o do anúncio (102).");
  assert.equal(statusDoEstado(r.estado), "rejected");
});

test("estado 2 — conta vencida e documento de outro imóvel", () => {
  assert.equal(decidirConferencia({ ...OK, dataDocumento: "2026-05-01" }, CAD).motivos[0].codigo, "vencido");
  const outro = decidirConferencia(
    { ...OK, endereco: { rua: "Av. Rondon Pacheco", numero: "999", cep: "38408000", bairro: null, cidade: null } },
    CAD,
  );
  assert.equal(outro.estado, "corrija");
  assert.equal(outro.motivos[0].codigo, "nao_corresponde");
});

test("estado 3 — titular diferente, print de tela ou leitura incerta vão para a revisão", () => {
  const titular = decidirConferencia({ ...OK, titular: "José Pereira" }, CAD);
  assert.equal(titular.estado, "revisao");
  assert.equal(titular.motivos[0].codigo, "titular_diverge");
  assert.equal(titular.checklist.titular, false);

  const print = decidirConferencia({ ...OK, sinaisDeEdicao: ["print de tela"] }, CAD);
  assert.equal(print.estado, "revisao");
  assert.equal(statusDoEstado(print.estado), "pending");
  // Sinal de edição + outro erro: continua com uma pessoa.
  assert.equal(decidirConferencia({ ...OK, sinaisDeEdicao: ["recorte"], dataDocumento: "2020-01-01" }, CAD).estado, "revisao");
  assert.equal(decidirConferencia({ ...OK, baixaConfianca: true }, CAD).estado, "revisao");
});

test("contrato de administração: gestor com proprietário listado passa no titular", () => {
  const r = decidirConferencia(
    { ...OK, tipo: "contrato_administracao", titular: "Imobiliária Exemplo", dataDocumento: null, proprietariosListados: ["João Silva"] },
    { ...CAD, operacao: "managed" },
  );
  assert.equal(r.estado, "aprovado");
});

test("PDF de 2 páginas lido como matrícula sem data: aprovado (sem prazo)", () => {
  assert.equal(decidirConferencia({ ...OK, tipo: "matricula", dataDocumento: null }, CAD).estado, "aprovado");
});

test("arquivo duplicado: Corrija com o motivo 'duplicado'; falha da IA: revisão", () => {
  const dup = decidirConferencia(OK, { ...CAD, duplicado: 1 });
  assert.equal(dup.estado, "corrija");
  assert.equal(dup.motivos[0].codigo, "duplicado");
  const falha = decidirConferencia(null, CAD);
  assert.equal(falha.estado, "revisao");
  assert.equal(falha.motivos[0].codigo, "falha_leitura");
});

test("sanearLeitura: rejeita lixo, corta o CPF para o parcial e ignora tipo fora da lista", () => {
  assert.equal(sanearLeitura(null), null);
  assert.equal(sanearLeitura({ tipo: "conta_consumo" }), null);
  const l = sanearLeitura({
    tipo: "boleto",
    titular: "<b>Ana</b>",
    cpf_cnpj_parcial: "123.456.789-01",
    endereco: { rua: "Rua A", numero: "1", bairro: null, cidade: null, cep: "38400-100" },
    data_documento: "17/10/2026",
    legivel: true,
    completo: true,
    sinais_de_edicao: ["print"],
    proprietarios_listados: [],
    baixa_confianca: false,
  });
  assert.ok(l);
  assert.equal(l.tipo, null);
  assert.equal(l.titular, "bAna/b");
  assert.equal(l.cpfCnpjParcial, "12345678");
  assert.equal(l.endereco.cep, "38400100");
  assert.equal(l.dataDocumento, null);
});

test("CPF sempre mascarado na tela", () => {
  assert.equal(mascararCpfParcial("123456"), "***.123.456-**");
  assert.equal(mascararCpfParcial(null), "***.***.***-**");
});

test("laboratório: o caso vem do marcador no arquivo fictício; leituras simuladas dão os 3 estados", () => {
  const bytes = new TextEncoder().encode("%PDF-1.4 ... VIVA-LAB-DOC:endereco_errado ...");
  assert.equal(casoLabDoArquivo(bytes), "endereco_errado");
  assert.equal(casoLabDoArquivo(new TextEncoder().encode("%PDF-1.4 sem marcador")), null);
  assert.equal(decidirConferencia(leituraSimulada("ok", CAD), CAD).estado, "aprovado");
  assert.equal(decidirConferencia(leituraSimulada("endereco_errado", CAD), CAD).estado, "corrija");
  assert.equal(decidirConferencia(leituraSimulada("editado", CAD), CAD).estado, "revisao");
  assert.equal(decidirConferencia(leituraSimulada("vencido", CAD), CAD).estado, "corrija");
});
