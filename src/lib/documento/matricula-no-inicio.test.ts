/* Roda: node --test src/lib/documento/matricula-no-inicio.test.ts — E149-A (a matrícula no início do cadastro). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camposDaMatriculaNoInicio, leituraFalhou, linhaDocumentoDoInicio, perguntaQuemOpera, resumoDoPreenchimento } from "./matricula-no-inicio.ts";

const vazio = { cep: "", rua: "", numero: "", bairro: "", areaM2: "", vagas: "", complemento: "" };
const leitura = {
  endereco: { rua: "Av. João Naves de Ávila", numero: "100", bairro: "Santa Mônica", cidade: "Uberlândia", uf: "MG", cep: "38408000" },
  unidade: "Apto 302",
  areaM2: 58,
  vagas: 1,
};

test("a matrícula lida no início preenche endereço, área, vagas e unidade (só o que está vazio)", () => {
  assert.deepEqual(camposDaMatriculaNoInicio(leitura, vazio), ["endereco", "area", "vagas", "complemento"]);
  assert.equal(resumoDoPreenchimento(["endereco", "area", "vagas"]), "Preenchemos: endereço, área, vagas.");
  // O que o dono já digitou não é trocado.
  assert.deepEqual(camposDaMatriculaNoInicio(leitura, { ...vazio, rua: "Rua do dono", areaM2: "70" }), ["vagas", "complemento"]);
  assert.equal(resumoDoPreenchimento([]), "");
});

test("dono diferente pergunta 'Quem opera'; leitura que falha segue sem travar", () => {
  assert.equal(perguntaQuemOpera("dono_diferente"), true);
  assert.equal(perguntaQuemOpera("falta_identidade"), false);
  assert.equal(leituraFalhou("falha_leitura"), true);
  assert.equal(leituraFalhou(null), false);
});

test("Passo 10: documento enviado no início aparece como enviado, sem pedir de novo", () => {
  assert.equal(linhaDocumentoDoInicio("revisao"), "Documento enviado no início · em análise");
  assert.equal(linhaDocumentoDoInicio("aprovado"), "Documento enviado no início · aprovado");
  assert.equal(linhaDocumentoDoInicio("nenhum"), null);
});

test("nome e CPF do titular nunca chegam à tela do início", () => {
  // Só o código conta: os comentários podem explicar a regra.
  const tela = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/matricula-no-inicio.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(tela, /\bcpf\b|titular|\.nome\b|console\./i);
});
