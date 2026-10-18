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
