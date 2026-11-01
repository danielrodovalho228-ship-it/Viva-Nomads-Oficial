import { test } from "node:test";
import assert from "node:assert/strict";
import { idSemResultado, lerRespostaCaf } from "./caf-resposta.ts";

// Respostas FICTÍCIAS montadas a partir da documentação pública (docs.caf.io); nenhum dado real.
const PERFIL = { name: "José da Silva", cpf: "52998224725" };

test("formato antigo (o que o código supunha): validations booleanas + risk.level", () => {
  const l = lerRespostaCaf({ validations: { identity: true, liveness: true, document: true }, risk: { level: "LOW" } }, PERFIL);
  assert.deepEqual([l.light, l.identity, l.liveness, l.document, l.ocrConfere], ["green", true, true, true, null]);
  assert.equal(lerRespostaCaf({ validations: { identity: true, liveness: true, document: true }, risk: { level: "HIGH" } }, PERFIL).light, "red");
});

test("formato da documentação: status + validations [{rule,status}] + sections.ocr.data com nome/CPF", () => {
  const l = lerRespostaCaf(
    {
      status: "APPROVED",
      validations: [
        { rule: "facematch_is_equal", status: "VALID" },
        { rule: "liveness_is_valid", status: "VALID" },
        { rule: "documentscopy_is_valid", status: "VALID" },
      ],
      sections: { ocr: { data: { name: "JOSE SILVA", cpf: "529.982.247-25", birthDate: "01/01/1980" } }, pfData: { data: { name: "José da Silva" } } },
    },
    PERFIL,
  );
  assert.deepEqual([l.light, l.identity, l.liveness, l.document], ["green", true, true, true]);
  assert.equal(l.ocrConfere, true);
  assert.equal(l.receitaConfere, true);
  // Nada do OCR volta no laudo (nem nome nem CPF nem nascimento).
  assert.ok(!JSON.stringify(l).includes("52998224725") && !JSON.stringify(l).includes("1980"));
});

test("OCR de outra pessoa → vermelho e ocrConfere=false", () => {
  const l = lerRespostaCaf({ status: "APPROVED", sections: { ocr: { data: { name: "Maria Souza", cpf: "11144477735" } } } }, PERFIL);
  assert.equal(l.ocrConfere, false);
  assert.equal(l.light, "red");
});

test("em análise (PENDING/PROCESSING) → nada aprovado ainda", () => {
  const l = lerRespostaCaf({ status: "PROCESSING" }, PERFIL);
  assert.deepEqual([l.identity, l.liveness, l.document, l.pendente, l.light], [false, false, false, true, "yellow"]);
});

test("regra reprovada derruba o item; status REPROVED é vermelho", () => {
  const l = lerRespostaCaf({ status: "REPROVED", validations: [{ rule: "liveness_is_valid", status: "INVALID" }] }, PERFIL);
  assert.equal(l.liveness, false);
  assert.equal(l.light, "red");
});

test("criação devolve só o id → buscar a transação por GET", () => {
  assert.equal(idSemResultado({ id: "abc123" }), "abc123");
  assert.equal(idSemResultado({ requestId: "r1" }), "r1");
  assert.equal(idSemResultado({ id: "abc", status: "APPROVED", sections: {} }), null);
  assert.equal(idSemResultado(null), null);
});

/*
  E293 P5 (parte de código) — `notes` guardava até 8 motivos da CAF em texto livre do fornecedor (pode trazer nome ou
  número do documento). Agora cada motivo vira uma frase fixa nossa; o texto do fornecedor não vai para caf_result.
*/
test("E293 P5: motivos da CAF viram frases fixas — nunca o texto do fornecedor", async () => {
  const { NOTAS_MOTIVO_CAF, notaDoMotivoCaf } = await import("./caf-resposta.ts");
  const { motivoDaReprovacao } = await import("../../config/verificacao-motivos.ts");
  const l = lerRespostaCaf(
    {
      validations: { identity: true, liveness: true, document: false },
      risk: { level: "MEDIUM", reasons: ["Low light on document of MARIA SOUZA", "Document blurry - CPF 11144477735", "Low light again", "Unknown rule 42"] },
    },
    PERFIL,
  );
  assert.deepEqual(l.notes, [NOTAS_MOTIVO_CAF.luz, NOTAS_MOTIVO_CAF.foco, NOTAS_MOTIVO_CAF.outro]);
  const json = JSON.stringify(l.notes);
  for (const proibido of ["MARIA", "11144477735", "Unknown", "Low light"]) assert.ok(!json.includes(proibido), proibido);
  for (const n of l.notes) assert.ok((Object.values(NOTAS_MOTIVO_CAF) as string[]).includes(n), n);
  // As frases fixas mantêm o motivo legível da tela (Prompt 50).
  assert.equal(motivoDaReprovacao({ notes: [notaDoMotivoCaf("escuro demais")] }), "foto_escura");
  assert.equal(motivoDaReprovacao({ document: false, notes: [notaDoMotivoCaf("documento borrado")] }), "documento_ilegivel");
  assert.equal(notaDoMotivoCaf("Face does not match"), NOTAS_MOTIVO_CAF.rosto);
  assert.equal(notaDoMotivoCaf("liveness failed"), NOTAS_MOTIVO_CAF.vida);
});
