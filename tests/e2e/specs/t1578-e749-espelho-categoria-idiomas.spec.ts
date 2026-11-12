import { test, expect } from "@playwright/test";
import { linhasDoEspelho } from "../../../src/lib/perfil/espelho";

/*
  T1578 — E749 (#3551): a prévia "É assim que o proprietário te vê" mostra categoria profissional e idiomas; sem dado (ou "Prefiro não informar"), a linha não
  aparece (nunca vazia nem inventada). Só lógica, roda no lab-crítico.
*/
test("E749: profissão e idiomas aparecem nas linhas do espelho", () => {
  const l = linhasDoEspelho("Designer", ["Português", "Inglês"]);
  expect(l.profissao).toContain("Designer");
  expect(l.idiomas).toContain("Português");
  expect(l.idiomas).toContain("Inglês");
});

test("E749: sem dado (ou com 'Prefiro não informar'), a linha não aparece: nunca 'Profissão: —' nem 'Idiomas:' vazio", () => {
  expect(linhasDoEspelho("", [])).toEqual({ profissao: null, idiomas: null });
  expect(linhasDoEspelho("Prefiro não informar", ["  "])).toEqual({ profissao: null, idiomas: null });
});
