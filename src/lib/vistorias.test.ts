import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarChecklistPadrao,
  comodosSemFoto,
  proximoStatusVistoria,
  vistoriaEditavel,
  podeIniciarVistoriaSaida,
  dispararEncerramentoEmD10,
  proximoStatusEncerramento,
  validarAcerto,
  montarDossie,
} from "./vistorias.ts";

test("checklist padrão tem itens por cômodo", () => {
  const c = montarChecklistPadrao();
  assert.ok(c.length >= 15);
  assert.ok(c.some((x) => x.comodo === "cozinha"));
});

test("mín. 1 foto por cômodo: aponta os que faltam", () => {
  const faltam = comodosSemFoto(["sala", "cozinha", "quarto"], { sala: 2, quarto: 1 });
  assert.deepEqual(faltam, ["cozinha"]);
});

test("vistoria: executor conclui → aguardando; inquilino confirma → assinada", () => {
  let s = proximoStatusVistoria("rascunho", { tipo: "concluir_executor" });
  assert.equal(s, "aguardando_confirmacao");
  s = proximoStatusVistoria(s, { tipo: "confirmar_inquilino" });
  assert.equal(s, "assinada");
});

test("o silêncio não assina: sem confirmação fica aguardando; contestação não assina", () => {
  const s = proximoStatusVistoria("aguardando_confirmacao", { tipo: "contestar_inquilino" });
  assert.equal(s, "aguardando_confirmacao");
  // assinada é imutável
  assert.equal(proximoStatusVistoria("assinada", { tipo: "confirmar_inquilino" }), "assinada");
  assert.equal(vistoriaEditavel("assinada"), false);
  assert.equal(vistoriaEditavel("aguardando_confirmacao"), true);
});

test("vistoria de saída só a partir da entrega (com folga)", () => {
  assert.equal(podeIniciarVistoriaSaida("2026-05-01", "2026-06-01"), false); // durante a vigência
  assert.equal(podeIniciarVistoriaSaida("2026-05-30", "2026-06-01", 3), true); // dentro da folga
  assert.equal(podeIniciarVistoriaSaida("2026-06-05", "2026-06-01"), true); // após o fim
});

test("D-10 dispara só sem renovação e na janela", () => {
  assert.equal(dispararEncerramentoEmD10("2026-05-25", "2026-06-01", false), true); // 7 dias
  assert.equal(dispararEncerramentoEmD10("2026-05-01", "2026-06-01", false), false); // longe
  assert.equal(dispararEncerramentoEmD10("2026-05-25", "2026-06-01", true), false); // tem renovação
});

test("encerramento: ativo → em_acerto → concluido", () => {
  let s = proximoStatusEncerramento("ativo", { tipo: "vistoria_saida_assinada" });
  assert.equal(s, "encerrado_em_acerto");
  s = proximoStatusEncerramento(s, { tipo: "acerto_finalizado" });
  assert.equal(s, "concluido");
});

test("acerto: devolução integral exige valor/data/meio", () => {
  assert.equal(validarAcerto({ tipo: "devolucao_integral", caucaoTotal: 3200, valorDevolvido: 3200, data: "2026-06-05", meio: "PIX" }, []).ok, true);
  assert.equal(validarAcerto({ tipo: "devolucao_integral", caucaoTotal: 3200, valorDevolvido: 0, data: "2026-06-05", meio: "PIX" }, []).ok, false);
});

test("REGRA 4.2: desconto SÓ vinculado a item de dano da vistoria assinada", () => {
  const danos = ["dano-1", "dano-2"];
  // desconto sem item de dano → rejeita
  const semDano = validarAcerto({ tipo: "desconto", caucaoTotal: 3200, descontos: [{ itemDanoId: "inexistente", valor: 300, justificativa: "risco" }] }, danos);
  assert.equal(semDano.ok, false);
  // desconto vinculado a dano válido → aceita e calcula restante
  const ok = validarAcerto({ tipo: "desconto", caucaoTotal: 3200, descontos: [{ itemDanoId: "dano-1", valor: 300, justificativa: "porta arranhada", fotoUrl: "x" }] }, danos);
  assert.equal(ok.ok, true);
  assert.equal(ok.totalDescontos, 300);
  assert.equal(ok.valorRestanteDevolver, 2900);
  // desconto sem justificativa → rejeita
  assert.equal(validarAcerto({ tipo: "desconto", caucaoTotal: 3200, descontos: [{ itemDanoId: "dano-1", valor: 300, justificativa: "" }] }, danos).ok, false);
  // soma maior que caução → rejeita
  assert.equal(validarAcerto({ tipo: "desconto", caucaoTotal: 300, descontos: [{ itemDanoId: "dano-1", valor: 400, justificativa: "x" }] }, danos).ok, false);
});

test("dossiê ordena cronologicamente", () => {
  const d = montarDossie([
    { quando: "2026-06-05", tipo: "saida", titulo: "Vistoria de saída" },
    { quando: "2026-03-15", tipo: "entrada", titulo: "Vistoria de entrada" },
  ]);
  assert.equal(d[0].tipo, "entrada");
  assert.equal(d[1].tipo, "saida");
});
