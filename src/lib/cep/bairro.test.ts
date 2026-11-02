/* Roda: node --test src/lib/cep/bairro.test.ts — E429 (02/11, substitui a regra do E147): bairro com nome de estado NÃO é
   erro. "Minas Gerais" é bairro oficial de Uberlândia (CEP 38402-288). O bairro do CEP é autoritativo; sobra só um aviso
   (não bloqueia) quando o digitado diverge do CEP e tem nome de estado/sigla/país/cidade. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aplicarResultadoCep } from "./aplicar.ts";
import { avisoDoBairro } from "./bairro.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("E429 — CEP 38402-288: o bairro 'Minas Gerais' do CEP entra no campo e não gera aviso nem erro", () => {
  const r = { tipo: "rua" as const, rua: "Avenida Comendador Alexandrino Garcia", bairro: "Minas Gerais", cidade: "Uberlândia", uf: "MG" };
  const a = aplicarResultadoCep(r, { rua: "", bairro: "", cidade: "" }, new Set());
  assert.equal(a.bairro, "Minas Gerais");
  assert.equal(avisoDoBairro("Minas Gerais", { bairroDoCep: "Minas Gerais", cidade: "Uberlândia" }), null);
  assert.equal(avisoDoBairro("minas gerais", { bairroDoCep: "Minas Gerais", cidade: "Uberlândia" }), null, "mesma coisa, sem acento/caixa");
});

test("E429 — outros bairros com nome de estado ou país, vindos do CEP, também valem", () => {
  for (const b of ["São Paulo", "Bahia", "Paraná", "Santa Catarina", "Brasil"]) assert.equal(avisoDoBairro(b, { bairroDoCep: b }), null, b);
});

test("E429 — CEP comum (bairro que não é nome de estado) segue normal", () => {
  assert.equal(avisoDoBairro("Santa Mônica", { bairroDoCep: "Santa Mônica", cidade: "Uberlândia" }), null);
  assert.equal(avisoDoBairro("Tibery", { bairroDoCep: "Santa Mônica", cidade: "Uberlândia" }), null, "divergência sem nome de lugar: o 'O CEP indica… confirmar?' já cobre");
});

test("E429 — digitado divergente do CEP com nome de estado: só AVISO (texto), nunca erro", () => {
  const aviso = avisoDoBairro("Minas Gerais", { bairroDoCep: "Santa Mônica", cidade: "Uberlândia" });
  assert.equal(aviso, "Confira o bairro: pelo CEP, é “Santa Mônica”. Se “Minas Gerais” estiver certo, pode continuar.");
  assert.ok(avisoDoBairro("MG", { bairroDoCep: "Santa Mônica" }));
  assert.ok(avisoDoBairro("Uberlândia", { bairroDoCep: "Santa Mônica", cidade: "Uberlândia" }));
  assert.equal(avisoDoBairro("Minas Gerais", {}), null, "sem CEP para comparar: nada");
});

test("E429 — nenhuma validação bloqueia pelo nome do bairro (tela, servidor, rascunho)", () => {
  const pagina = ler("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const etapa = pagina.slice(pagina.indexOf("function validarEtapa"), pagina.indexOf("if (s === ETAPA.fotos"));
  assert.match(etapa, /if \(!neighborhood\.trim\(\)\) e\.bairro = "Informe o bairro\.";/);
  const codigo = etapa.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(codigo, /avisoDoBairro|problemaDoBairro|estado/);
  assert.match(pagina, /if \(a\.bairro !== undefined\) setNeighborhood\(a\.bairro\.trim\(\)\);/);
  for (const f of ["../data/actions.ts", "../data/rascunho-campos.ts"]) assert.doesNotMatch(ler(f), /problemaDoBairro|bairroAceitavel|é um estado, não um bairro/, f);
  assert.doesNotMatch(ler("./bairro.ts"), /é um estado, não um bairro/);
});
