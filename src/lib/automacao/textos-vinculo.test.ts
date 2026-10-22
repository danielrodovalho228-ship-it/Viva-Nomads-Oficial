/*
  Prompt 38 — e-mails do vínculo de parceiro fixo: quem convidou, para qual serviço e qual imóvel; aceite ou recusa.
  Roda: node --test src/lib/automacao/textos-vinculo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { textoConvite, textoResposta, type DadosVinculo } from "./textos-vinculo.ts";
import { comMarca, problemasDoAssunto } from "../notifications/assuntos.ts";

const d: DadosVinculo = { categoria: "limpeza", tituloImovel: "Apto Santa Mônica", cidade: "Uberlândia", nomeDono: "Paulo Henrique Souza", nomeParceiro: "Brilho Limpezas" };

test("convite: primeiro nome do dono, serviço fixo e o imóvel (sem sobrenome nem endereço)", () => {
  const t = textoConvite(d);
  assert.equal(t.subject, "Paulo quer você como limpeza fixa");
  assert.equal(
    t.body("Ana"),
    "Olá Ana, Paulo quer você como limpeza fixa de Apto Santa Mônica (Uberlândia). Os pedidos chegam a cada saída de morador, com a janela de horário, e você aceita ou recusa cada um. Responda ao convite em Imóveis fixos.",
  );
  assert.ok(!t.body().includes("Souza"));
  assert.equal(textoConvite({ ...d, categoria: "manutencao" }).subject, "Paulo quer você como manutenção fixa");
});

test("resposta: diz se aceitou ou recusou, com o nome público do parceiro", () => {
  const sim = textoResposta(d, true);
  assert.equal(sim.subject, "Brilho Limpezas aceitou ser sua limpeza fixa");
  assert.match(sim.body("Paulo"), /^Olá Paulo, Brilho Limpezas aceitou ser limpeza fixa de Apto Santa Mônica \(Uberlândia\)\./);
  const nao = textoResposta(d, false);
  assert.equal(nao.subject, "Brilho Limpezas recusou ser sua limpeza fixa");
  assert.match(nao.body("Paulo"), /recusou o convite para ser limpeza fixa de Apto Santa Mônica \(Uberlândia\)\. Escolha outro parceiro da cidade em Parceiros do imóvel\.$/);
});

test("sem nome ou título: frase continua correta", () => {
  const vazio: DadosVinculo = { categoria: "lavanderia", tituloImovel: null, cidade: null, nomeDono: null, nomeParceiro: null };
  assert.equal(textoConvite(vazio).subject, "Um proprietário quer você como lavanderia fixa");
  assert.match(textoConvite(vazio).body(), /^Olá, Um proprietário quer você como lavanderia fixa de um imóvel\./);
  assert.equal(textoResposta(vazio, true).subject, "O parceiro aceitou ser sua lavanderia fixa");
});

test("assuntos na regra da casa (70 caracteres com a marca, sem caixa alta), mesmo com nome longo", () => {
  const longo: DadosVinculo = { ...d, nomeDono: "MARIA EDUARDA DOS SANTOS", nomeParceiro: "LIMPEZA TOTAL E COMPLETA DE APARTAMENTOS LTDA 12345" };
  for (const s of [textoConvite(d).subject, textoResposta(d, true).subject, textoResposta(d, false).subject, textoConvite(longo).subject, textoResposta(longo, true).subject, textoResposta({ ...longo, categoria: "manutencao" }, false).subject]) {
    assert.deepEqual(problemasDoAssunto(comMarca(s)), [], s);
  }
});
