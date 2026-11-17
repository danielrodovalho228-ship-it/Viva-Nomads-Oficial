/*
  E986 — Espaço de trabalho (Perfil): a escolha feita ENQUANTO a tela ainda lê o que está gravado era apagada quando a
  leitura chegava (o componente sobrescrevia os dois campos), e o "Salvar" gravava vazio com "Salvo." na tela. O t590
  (1280 px) falhou 3 de 3 vezes por isso e nunca teve verde.
  Regra: a leitura só preenche o campo em que a pessoa ainda não mexeu.
  Roda: node --test src/lib/perfil/e986-escolha-durante-a-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aposLerEspacoTrabalho } from "./espaco-trabalho.ts";

const NADA = { oferta: false, procura: false };

test("sem mexer em nada, a tela mostra o que está gravado", () => {
  assert.deepEqual(aposLerEspacoTrabalho({ oferta: "", procura: "" }, { oferta: "sala", procura: "coworking" }, NADA), { oferta: "sala", procura: "coworking" });
  assert.deepEqual(aposLerEspacoTrabalho({ oferta: "", procura: "" }, { oferta: null, procura: null }, NADA), { oferta: "", procura: "" });
});

test("a escolha feita durante a leitura fica; o outro campo recebe o que está gravado", () => {
  // O caso do t590: nada gravado, a pessoa escolheu "coworking" antes de a leitura chegar.
  assert.deepEqual(aposLerEspacoTrabalho({ oferta: "", procura: "coworking" }, { oferta: null, procura: null }, { oferta: false, procura: true }), { oferta: "", procura: "coworking" });
  // Havia resposta gravada nos dois; a pessoa trocou só a procura.
  assert.deepEqual(aposLerEspacoTrabalho({ oferta: "", procura: "nao" }, { oferta: "consultorio", procura: "coworking" }, { oferta: false, procura: true }), { oferta: "consultorio", procura: "nao" });
  // Trocou só a oferta.
  assert.deepEqual(aposLerEspacoTrabalho({ oferta: "sala", procura: "" }, { oferta: "consultorio", procura: "coworking" }, { oferta: true, procura: false }), { oferta: "sala", procura: "coworking" });
});

test("escolher 'Prefiro não responder' durante a leitura também é uma escolha (não volta o valor gravado)", () => {
  assert.deepEqual(aposLerEspacoTrabalho({ oferta: "", procura: "" }, { oferta: "sala", procura: "coworking" }, { oferta: true, procura: true }), { oferta: "", procura: "" });
});

test("o componente usa a regra e marca o campo mexido em cada troca", () => {
  const c = readFileSync(new URL("../../components/account/espaco-trabalho.tsx", import.meta.url), "utf8");
  assert.match(c, /aposLerEspacoTrabalho\(/);
  // A leitura não escreve mais direto nos dois campos.
  assert.doesNotMatch(c, /setProcura\(v\.procura \?\? ""\)/);
  assert.doesNotMatch(c, /setOferta\(v\.oferta \?\? ""\)/);
  assert.match(c, /mexeu\.current\.oferta = true/);
  assert.match(c, /mexeu\.current\.procura = true/);
  // O "Salvar" continua desligado enquanto lê: nada é gravado antes de a tela saber o que já estava salvo (achados 67–69).
  assert.match(c, /disabled=\{salvando \|\| carregando\}/);
});
