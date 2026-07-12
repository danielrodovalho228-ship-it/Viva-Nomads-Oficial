/*
  Testes das regras de conferência de documentos (fila de moderação do admin).
  Roda com: node --experimental-strip-types --test src/lib/moderacao-doc.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CHECKLIST_CONFERENCIA,
  conferenciaCompleta,
  comporMotivoRecusa,
  tipoVisualizacaoDoc,
} from "./moderacao-doc.ts";

test("conferenciaCompleta: só true com TODOS os itens marcados", () => {
  assert.equal(conferenciaCompleta({}), false);
  const parcial: Record<string, boolean> = {};
  for (const i of CHECKLIST_CONFERENCIA.slice(0, -1)) parcial[i.key] = true;
  assert.equal(conferenciaCompleta(parcial), false); // falta 1
  const todos: Record<string, boolean> = {};
  for (const i of CHECKLIST_CONFERENCIA) todos[i.key] = true;
  assert.equal(conferenciaCompleta(todos), true);
});

test("comporMotivoRecusa: motivo estruturado vira rótulo legível", () => {
  assert.equal(comporMotivoRecusa("ilegivel"), "Documento ilegível ou incompleto");
  assert.equal(
    comporMotivoRecusa("vencido", "a matrícula é de 2019"),
    "Documento vencido / desatualizado — a matrícula é de 2019"
  );
});

test("comporMotivoRecusa: 'outro' exige detalhe; vazio → null", () => {
  assert.equal(comporMotivoRecusa("outro"), null);
  assert.equal(comporMotivoRecusa("outro", "  "), null);
  assert.equal(comporMotivoRecusa("outro", "documento de outro imóvel"), "documento de outro imóvel");
  assert.equal(comporMotivoRecusa(""), null); // sem motivo
});

test("tipoVisualizacaoDoc: escolhe o visualizador pela extensão", () => {
  assert.equal(tipoVisualizacaoDoc("uid/abc.pdf"), "pdf");
  assert.equal(tipoVisualizacaoDoc("uid/abc.PNG"), "imagem");
  assert.equal(tipoVisualizacaoDoc("uid/abc.jpeg"), "imagem");
  assert.equal(tipoVisualizacaoDoc("uid/abc.docx"), "outro");
  assert.equal(tipoVisualizacaoDoc(null), "outro");
});
