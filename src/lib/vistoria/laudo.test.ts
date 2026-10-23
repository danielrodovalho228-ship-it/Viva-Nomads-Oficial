/*
  Prompt 62-B2 — checklist único, resultado, nível sustentado, prazos, "· vistoriado" e contestação. PURO.
  Roda: node --test src/lib/vistoria/laudo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAVES_GRAVES,
  DELIMITACAO_LAUDO,
  GRUPOS_AVALIACAO,
  ITENS_CHECKLIST,
  VERSAO_CHECKLIST,
  valoresDoItem,
  type ItemChecklist,
  type ValorItem,
} from "../../config/checklist-avaliacao.ts";
import { CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { CHAVES_NIVEL } from "../../config/niveis.ts";
import type { MedidaPonto, RespostasRuido } from "../niveis/regras.ts";
import {
  avisoExpiracao,
  devolucaoVencida,
  exibicaoAvaliacao,
  itensSemResposta,
  laudoAtrasado,
  nivelSustentado,
  podeContestar,
  prazoLaudo,
  quemPerdePaga,
  resultadoAvaliacao,
  ressalvaVencida,
  resumoPorGrupo,
  somarHorasUteis,
  valorValido,
  type DadosLaudoExibicao,
  type Respostas,
} from "./laudo.ts";

const ITENS = ITENS_CHECKLIST as readonly ItemChecklist[];
const AGORA = new Date("2026-10-23T12:00:00Z");

/** Tudo conforme (limpeza "pronto"). */
const tudoOk = (): Record<string, ValorItem> => Object.fromEntries(ITENS.map((i) => [i.chave, i.tipo === "limpeza" ? "pronto" : "conforme"]));
const medida = (ponto: MedidaPonto["ponto"]): MedidaPonto => ({
  ponto,
  validada: true,
  medidoEm: "2026-10-20T12:00:00Z",
  validoAte: "2027-04-20T12:00:00Z",
  downloadMbps: 200,
  uploadMbps: 100,
  latenciaMs: 15,
});
const silencioso: RespostasRuido = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false };

test("checklist versionado: 9 grupos, chaves únicas, critério escrito e ligações válidas", () => {
  assert.equal(VERSAO_CHECKLIST, 1);
  assert.equal(GRUPOS_AVALIACAO.length, 9);
  const chaves = ITENS.map((i) => i.chave);
  assert.equal(new Set(chaves).size, chaves.length);
  for (const g of GRUPOS_AVALIACAO) assert.ok(ITENS.some((i) => i.grupo === g.id), `grupo sem item: ${g.id}`);
  for (const i of ITENS) {
    assert.ok(i.criterio.length >= 10, `critério curto: ${i.chave}`);
    if (i.conforto) assert.ok((CHAVES_CONFORTO as readonly string[]).includes(i.conforto), `conforto inválido: ${i.chave}`);
    if (i.nivel) assert.ok((CHAVES_NIVEL as readonly string[]).includes(i.nivel), `nível inválido: ${i.chave}`);
    assert.ok(i.reverificacao === "foto" || i.reverificacao === "visita");
  }
  // Os 12 itens do padrão mínimo v2 têm conferência no checklist.
  for (const c of CHAVES_CONFORTO) assert.ok(ITENS.some((i) => i.conforto === c), `mínimo sem conferência: ${c}`);
  // Graves: gás, fiação exposta, fechadura da entrada.
  assert.deepEqual([...CHAVES_GRAVES].sort(), ["fechadura_entrada", "fiacao_exposta", "gas_vazamento"]);
  // Testes em uso e do cheiro.
  for (const k of ["chuveiro_teste", "ar_quarto_principal", "faca_corta", "panela_revestimento"]) assert.ok(ITENS.find((i) => i.chave === k)?.testeEmUso, k);
  assert.deepEqual(ITENS.filter((i) => i.tipo === "cheiro").map((i) => i.chave), ["cheiro_mofo", "cheiro_esgoto", "cheiro_fumaca", "cheiro_cigarro"]);
  assert.deepEqual(valoresDoItem(ITENS.find((i) => i.chave === "limpeza_estado")!), ["pronto", "leve", "nao_habitavel"]);
  assert.match(DELIMITACAO_LAUDO, /^Retrato do estado do imóvel na data da avaliação/);
});

test("valores aceitos e checklist completo", () => {
  assert.ok(valorValido("fechadura_entrada", "conforme"));
  assert.ok(!valorValido("fechadura_entrada", "nao_se_aplica")); // segurança não aceita "não se aplica"
  assert.ok(!valorValido("limpeza_estado", "conforme"));
  assert.ok(!valorValido("nao_existe", "conforme"));
  const r = tudoOk();
  assert.deepEqual(itensSemResposta(r), []);
  delete r.cheiro_mofo;
  assert.deepEqual(itensSemResposta(r), ["cheiro_mofo"]);
});

test("resultadoAvaliacao: aprovado, com ressalvas (até 3, com reverificação do item) e reprovado", () => {
  assert.equal(resultadoAvaliacao(tudoOk()).resultado, "aprovado");

  // Item só de nível não conforme não é falha (baixa o nível, não reprova).
  assert.equal(resultadoAvaliacao({ ...tudoOk(), sono_padrao_hotel: "nao_conforme", ar_sala: "nao_conforme" }).resultado, "aprovado");
  // Detector/extintor é só registro.
  assert.equal(resultadoAvaliacao({ ...tudoOk(), detector_extintor: "nao_conforme" }).resultado, "aprovado");

  const r = resultadoAvaliacao({ ...tudoOk(), chuveiro_teste: "nao_conforme", limpeza_estado: "leve", cheiro_mofo: "nao_conforme" });
  assert.equal(r.resultado, "com_ressalvas");
  assert.deepEqual(r.ressalvas, [
    { chave: "chuveiro_teste", reverificacao: "visita" },
    { chave: "limpeza_estado", reverificacao: "foto" },
    { chave: "cheiro_mofo", reverificacao: "visita" },
  ]);

  const quatro = resultadoAvaliacao({ ...tudoOk(), chuveiro_teste: "nao_conforme", limpeza_estado: "leve", cheiro_mofo: "nao_conforme", iluminacao: "nao_conforme" });
  assert.equal(quatro.resultado, "reprovado");
  assert.deepEqual(quatro.ressalvas, []);
  assert.equal(resultadoAvaliacao({ ...tudoOk(), limpeza_estado: "nao_habitavel" }).resultado, "reprovado");
});

test("segurança GRAVE não conforme é marcada em qualquer resultado", () => {
  const r = resultadoAvaliacao({ ...tudoOk(), fechadura_entrada: "nao_conforme" });
  assert.equal(r.resultado, "com_ressalvas");
  assert.deepEqual(r.graves, ["fechadura_entrada"]);
  const rep = resultadoAvaliacao({ ...tudoOk(), limpeza_estado: "nao_habitavel", gas_vazamento: "nao_conforme", fiacao_exposta: "nao_conforme" });
  assert.equal(rep.resultado, "reprovado");
  assert.deepEqual(rep.graves, ["gas_vazamento", "fiacao_exposta"]);
  assert.deepEqual(resultadoAvaliacao({ ...tudoOk(), gas_vazamento: "nao_se_aplica" }).graves, []);
});

test("nível SUSTENTADO pelo laudo: elo mais fraco com o que o avaliador conferiu", () => {
  const medidas = [medida("quarto_principal"), medida("trabalho")];
  assert.equal(nivelSustentado(tudoOk(), silencioso, medidas, AGORA), "premium");
  // Um item de Premium não conforme derruba o imóvel para Conforto.
  assert.equal(nivelSustentado({ ...tudoOk(), ar_sala: "nao_conforme" }, silencioso, medidas, AGORA), "conforto");
  // Um item de Conforto não conforme derruba para Essencial.
  assert.equal(nivelSustentado({ ...tudoOk(), sono_dois_jogos: "nao_conforme" }, silencioso, medidas, AGORA), "essencial");
  // Sem medição na hora: internet não sustenta Conforto.
  assert.equal(nivelSustentado(tudoOk(), silencioso, [], AGORA), "essencial");
  // Padrão mínimo não conforme (limpeza leve) = em adequação.
  assert.equal(nivelSustentado({ ...tudoOk(), limpeza_estado: "leve" }, silencioso, medidas, AGORA), "em_adequacao");
  // Ruído alto sem isolamento não chega a Conforto.
  assert.equal(nivelSustentado(tudoOk(), { ...silencioso, via_intensa: true, aviao_ferrovia: true }, medidas, AGORA), "essencial");
});

test("resumo por grupo: conformes e não conformes por rótulo", () => {
  const res = resumoPorGrupo({ ...tudoOk(), faca_corta: "nao_conforme" });
  assert.equal(res.length, 9);
  const coz = res.find((g) => g.grupo === "cozinha")!;
  assert.deepEqual(coz.naoConformes, ["Faca que corta"]);
  // Detector/extintor (registro) não entra no resumo.
  const seg = res.find((g) => g.grupo === "seguranca")!;
  assert.equal(seg.conformes, ITENS.filter((i) => i.grupo === "seguranca" && !i.registro).length);
});

test("48 horas úteis (seg a sex, Brasília)", () => {
  // Quinta 10h BRT → segunda 10h BRT (pula o fim de semana).
  assert.equal(somarHorasUteis(new Date("2026-10-22T13:00:00Z"), 48).toISOString(), "2026-10-26T13:00:00.000Z");
  // Segunda 10h → quarta 10h.
  assert.equal(prazoLaudo("2026-10-19T13:00:00Z").toISOString(), "2026-10-21T13:00:00.000Z");
  // Sábado → conta a partir de segunda 0h BRT.
  assert.equal(somarHorasUteis(new Date("2026-10-24T15:00:00Z"), 48).toISOString(), "2026-10-28T03:00:00.000Z");
  assert.ok(laudoAtrasado("2026-10-19T13:00:00Z", null, new Date("2026-10-21T13:00:01Z")));
  assert.ok(!laudoAtrasado("2026-10-19T13:00:00Z", "2026-10-20T10:00:00Z", new Date("2026-10-25T00:00:00Z")));
});

test("ressalva: 15 dias para corrigir", () => {
  assert.ok(!ressalvaVencida("2026-10-01T12:00:00Z", null, new Date("2026-10-16T11:00:00Z")));
  assert.ok(ressalvaVencida("2026-10-01T12:00:00Z", null, new Date("2026-10-16T12:00:01Z")));
  assert.ok(!ressalvaVencida("2026-10-01T12:00:00Z", "2026-10-10T12:00:00Z", new Date("2026-11-01T00:00:00Z")));
});

const dados = (extra: Partial<DadosLaudoExibicao> = {}): DadosLaudoExibicao => ({
  resultado: "aprovado",
  nivel: "premium",
  vistoriadoEm: "2026-01-10T12:00:00Z",
  numeroCredenciado: "SP-0001",
  resumo: resumoPorGrupo(tudoOk()),
  codigoConferir: "ABCD-1234",
  ...extra,
});

test("\"· vistoriado\": só aprovado/corrigido, sem strike, por 12 meses; aviso 30 dias antes", () => {
  const e = exibicaoAvaliacao(dados(), AGORA)!;
  assert.equal(e.nivel, "premium");
  assert.equal(e.numeroCredenciado, "SP-0001");
  assert.equal(e.linkConferir, "/conferir?codigo=ABCD-1234");
  assert.deepEqual(Object.keys(e).sort(), ["linkConferir", "nivel", "numeroCredenciado", "resumoPorGrupo", "vistoriadoEm"]);
  assert.equal(exibicaoAvaliacao(dados({ resultado: "reprovado" }), AGORA), null);
  assert.equal(exibicaoAvaliacao(dados({ resultado: "com_ressalvas", vistoriadoEm: null }), AGORA), null);
  assert.equal(exibicaoAvaliacao(dados({ semVistoriadoPorStrike: true }), AGORA), null);
  assert.equal(exibicaoAvaliacao(null, AGORA), null);
  // Expira no dia (12 meses).
  assert.ok(exibicaoAvaliacao(dados(), new Date("2027-01-10T11:59:59Z")));
  assert.equal(exibicaoAvaliacao(dados(), new Date("2027-01-10T12:00:00Z")), null);
  assert.ok(avisoExpiracao("2026-01-10T12:00:00Z", new Date("2026-12-12T12:00:00Z")));
  assert.ok(!avisoExpiracao("2026-01-10T12:00:00Z", new Date("2026-12-10T11:00:00Z")));
  assert.ok(!avisoExpiracao("2026-01-10T12:00:00Z", new Date("2027-01-11T00:00:00Z")));
});

test("contestação: 7 dias, uma vez; quem perde paga e devolução em 15 dias", () => {
  assert.deepEqual(podeContestar("2026-10-20T12:00:00Z", AGORA, false), { ok: true });
  assert.equal(podeContestar("2026-10-10T12:00:00Z", AGORA, false).ok, false);
  assert.equal(podeContestar("2026-10-20T12:00:00Z", AGORA, true).ok, false);

  assert.deepEqual(quemPerdePaga({ resultado: "com_ressalvas", nivel: "conforto" }, { resultado: "aprovado", nivel: "conforto" }), { donoVenceu: true, devolucaoDevida: true });
  assert.deepEqual(quemPerdePaga({ resultado: "aprovado", nivel: "conforto" }, { resultado: "aprovado", nivel: "premium" }), { donoVenceu: true, devolucaoDevida: true });
  assert.deepEqual(quemPerdePaga({ resultado: "aprovado", nivel: "premium" }, { resultado: "aprovado", nivel: "premium" }), { donoVenceu: false, devolucaoDevida: false });
  assert.deepEqual(quemPerdePaga({ resultado: "aprovado", nivel: "premium" }, { resultado: "reprovado", nivel: "essencial" }), { donoVenceu: false, devolucaoDevida: false });

  assert.ok(devolucaoVencida("2026-10-20T00:00:00Z", null, AGORA));
  assert.ok(!devolucaoVencida("2026-10-20T00:00:00Z", "2026-10-19T00:00:00Z", AGORA));
  assert.ok(!devolucaoVencida("2026-11-01T00:00:00Z", null, AGORA));
});
