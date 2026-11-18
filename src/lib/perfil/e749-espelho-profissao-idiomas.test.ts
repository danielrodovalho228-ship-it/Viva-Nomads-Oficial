// E749: a prévia "É assim que o proprietário te vê" não mostrava a categoria profissional nem os idiomas, que o texto da seção promete.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasDoEspelho } from "./espelho.ts";
import { categoriaLabel } from "../../config/categorias-profissionais.ts";

test("E749: profissão e idiomas entram quando preenchidos", () => {
  assert.deepEqual(linhasDoEspelho("Médico(a) residente", ["Português", "Inglês"]), { profissao: "Médico(a) residente", idiomas: "Português, Inglês" });
  assert.equal(categoriaLabel("saude_medico_residente"), "Médico(a) residente");
});

test("E749: nada de linha vazia — sem profissão, 'prefiro não informar' ou sem idioma, a linha some", () => {
  assert.deepEqual(linhasDoEspelho(null, []), { profissao: null, idiomas: null });
  assert.deepEqual(linhasDoEspelho("Prefiro não informar", ["  "]), { profissao: null, idiomas: null });
  assert.deepEqual(linhasDoEspelho("  ", undefined), { profissao: null, idiomas: null });
});

test("E749: o espelho do morador desenha as duas linhas, e a tela do perfil as alimenta (só com o bloco ligado)", () => {
  const espelho = readFileSync("src/components/account/espelho-perfil.tsx", "utf8");
  assert.match(espelho, /data-testid="espelho-profissao"/);
  assert.match(espelho, /data-testid="espelho-idiomas"/);
  const papel = readFileSync("src/components/account/espelho-papel.tsx", "utf8");
  assert.match(papel, /profissao=\{p\.profissao\} idiomas=\{p\.idiomas\}/);
  const tela = readFileSync("src/components/account/perfil-tela.tsx", "utf8");
  assert.equal((tela.match(/profissao=\{profLigado && p\.profissao && p\.profissao !== CATEGORIA_NAO_INFORMAR \? categoriaLabel\(p\.profissao\) : null\} idiomas=\{idiomasLigado \? idiomas : \[\]\}/g) ?? []).length, 2, "os dois espelhos (computador e celular)");
});
