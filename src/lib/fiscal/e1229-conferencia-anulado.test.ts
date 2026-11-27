/*
  E1229 (ORDEM-DUET-1143): a página de conferência de um documento anulado diz QUANDO e POR QUÊ —
  "Anulado em {data}: {motivo}" (a data em Brasília, do status_em do registro do documento). Puro.
  Roda: node --test src/lib/fiscal/e1229-conferencia-anulado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { situacaoDoDocumento } from "./conferir.ts";

const base = { is_teste: false, versao_vigente: null } as const;

test("anulado: 'Anulado em {data}: {motivo}', com a data de Brasília", () => {
  const s = situacaoDoDocumento({ ...base, status: "anulado", anulado_motivo: "registro em duplicidade", status_em: "2026-11-27T02:30:00Z" } as never);
  assert.equal(s.estado, "anulado");
  assert.match(s.texto, /^Anulado em 26\/11\/2026: registro em duplicidade\./, "02:30 UTC é 26/11 23:30 em Brasília");
});

test("anulado sem a data gravada: 'Anulado: {motivo}' (nunca uma data inventada)", () => {
  const s = situacaoDoDocumento({ ...base, status: "anulado", anulado_motivo: "registro em duplicidade", status_em: null } as never);
  assert.match(s.texto, /^Anulado: registro em duplicidade\./);
});

test("válido e substituído ficam como estavam", () => {
  assert.equal(situacaoDoDocumento({ ...base, status: "valido", anulado_motivo: null, status_em: null } as never).texto, "Documento válido, registrado pela plataforma Viva Nomads.");
  assert.match(situacaoDoDocumento({ ...base, status: "substituido", anulado_motivo: null, status_em: null, versao_vigente: 2 } as never).texto, /^Documento SUBSTITUÍDO pela versão 2\./);
});
