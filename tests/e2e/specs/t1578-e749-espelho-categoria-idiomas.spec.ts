import { test, expect } from "@playwright/test";
import { linhasDoEspelho } from "../../../src/lib/perfil/espelho";

/*
  T1578 — E749 (#3551): a prévia "É assim que o proprietário te vê" mostra categoria profissional e idiomas; sem dado, diz "Prefiro não informar"
  (nunca vazio nem inventado). Só lógica, roda no lab-crítico.
*/
test("E749: profissão e idiomas aparecem nas linhas do espelho", () => {
  const l = linhasDoEspelho("Designer", ["Português", "Inglês"]);
  expect(l.profissao).toContain("Designer");
  expect(l.idiomas).toContain("Português");
  expect(l.idiomas).toContain("Inglês");
});

test("E749: sem profissão e sem idiomas, 'Prefiro não informar' nas duas linhas", () => {
  const l = linhasDoEspelho("", []);
  expect(l.profissao).toBe("Prefiro não informar");
  expect(l.idiomas).toBe("Prefiro não informar");
});
