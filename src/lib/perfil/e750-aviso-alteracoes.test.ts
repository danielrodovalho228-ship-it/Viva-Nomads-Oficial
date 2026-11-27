// E750: "Há alterações para salvar" some assim que o perfil é salvo. O caso que deixava o aviso de pé: desligar e limpar o bloco
// "Idiomas" GRAVA os idiomas vazios na hora, mas o retrato do que está salvo continuava com os idiomas antigos — a tela seguia
// comparando "sem idiomas" com "com idiomas" e dizia que havia o que salvar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { perfilAlterado, retrato, retratoSemIdiomas } from "./retrato.ts";

test("E750: editar acende o aviso; salvar apaga", () => {
  const salvo = retrato("Ana", "Sou médica", "Uberlândia", ["Português"]);
  assert.equal(perfilAlterado(salvo, retrato("Ana", "Sou médica", "Uberlândia", ["Português"])), false);
  assert.equal(perfilAlterado(salvo, retrato("Ana", "Sou médica e tranquila", "Uberlândia", ["Português"])), true);
  const depoisDeSalvar = retrato("Ana", "Sou médica e tranquila", "Uberlândia", ["Português"]);
  assert.equal(perfilAlterado(depoisDeSalvar, retrato("Ana", "Sou médica e tranquila", "Uberlândia", ["Português"])), false);
});

test("E750: limpar os idiomas (gravado na hora) leva o retrato salvo junto — o aviso não fica de pé", () => {
  const salvo = retrato("Ana", "Sou médica", "Uberlândia", ["Português", "Inglês"]);
  const naTelaSemIdiomas = retrato("Ana", "Sou médica", "Uberlândia", []); // bloco desligado
  assert.equal(perfilAlterado(salvo, naTelaSemIdiomas), true, "antes da correção, o aviso ficava assim");
  assert.equal(perfilAlterado(retratoSemIdiomas(salvo), naTelaSemIdiomas), false);
  // o resto do perfil não muda com a limpeza
  assert.deepEqual(JSON.parse(retratoSemIdiomas(salvo)!), ["Ana", "Sou médica", "Uberlândia", []]);
});

test("E750: sem perfil carregado não há aviso; retrato ilegível é devolvido como veio", () => {
  assert.equal(perfilAlterado(null, retrato("", "", "", [])), false);
  assert.equal(retratoSemIdiomas(null), null);
  assert.equal(retratoSemIdiomas("não é json"), "não é json");
});

test("E750: a tela atualiza o retrato ao limpar os idiomas e usa o cálculo único", () => {
  const t = readFileSync("src/components/account/perfil-tela.tsx", "utf8");
  assert.match(t, /setSalvo\(\(a\) => retratoSemIdiomas\(a\)\)/);
  assert.match(t, /const alterado = perfilAlterado\(salvo, retrato\(nome, bio, cidade, idiomasLigado \? idiomas : \[\]\)\)/);
  assert.doesNotMatch(t, /^function retrato\(/m);
});
