import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarCep, buscarPorEndereco, mensagemCep, formatarCep, URL_BRASILAPI, URL_VIACEP, type Buscar } from "./buscar.ts";

/** Respostas simuladas por URL; "rede" = a chamada falha (sem internet). */
function simular(mapa: Record<string, { status: number; corpo?: unknown } | "rede">): { buscar: Buscar; chamadas: string[] } {
  const chamadas: string[] = [];
  const buscar: Buscar = async (url) => {
    chamadas.push(url);
    const r = mapa[url];
    if (!r || r === "rede") throw new Error("falha de rede");
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.corpo };
  };
  return { buscar, chamadas };
}

const VIA = (cep: string) => `${URL_VIACEP}/${cep}/json/`;
const BR = (cep: string) => `${URL_BRASILAPI}/${cep}`;

test("ViaCEP acha com rua → preenche e nem chama a BrasilAPI", async () => {
  const { buscar, chamadas } = simular({
    [VIA("38400100")]: { status: 200, corpo: { cep: "38400-100", logradouro: "Av. Afonso Pena", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } },
  });
  const r = await buscarCep("38400-100", buscar);
  assert.deepEqual(r, { tipo: "rua", rua: "Av. Afonso Pena", bairro: "Centro", cidade: "Uberlândia", uf: "MG" });
  assert.equal(chamadas.length, 1);
  assert.equal(mensagemCep(r), "Endereço encontrado");
});

test("ViaCEP responde erro e a BrasilAPI acha → preenche pela BrasilAPI", async () => {
  const { buscar, chamadas } = simular({
    [VIA("38408100")]: { status: 200, corpo: { erro: "true" } },
    [BR("38408100")]: { status: 200, corpo: { cep: "38408100", state: "MG", city: "Uberlândia", neighborhood: "Santa Mônica", street: "Rua Nova" } },
  });
  const r = await buscarCep("38408100", buscar);
  assert.deepEqual(r, { tipo: "rua", rua: "Rua Nova", bairro: "Santa Mônica", cidade: "Uberlândia", uf: "MG" });
  assert.deepEqual(chamadas, [VIA("38408100"), BR("38408100")]);
});

test("os dois não acham (38482-288, o CEP do print) → 'Não encontramos', com convite para buscar pelo endereço", async () => {
  const { buscar } = simular({
    [VIA("38482288")]: { status: 200, corpo: { erro: "true" } },
    [BR("38482288")]: { status: 404, corpo: { message: "Todos os serviços de CEP retornaram erro." } },
  });
  const r = await buscarCep("38482-288", buscar);
  assert.deepEqual(r, { tipo: "nao_encontrado" });
  assert.match(mensagemCep(r), /Não encontramos esse CEP/);
  assert.match(mensagemCep(r), /buscar pelo endereço/);
});

test("CEP geral (só cidade) → preenche cidade/UF e pede a rua", async () => {
  const { buscar } = simular({
    [VIA("38440000")]: { status: 200, corpo: { cep: "38440-000", logradouro: "", bairro: "", localidade: "Araguari", uf: "MG" } },
    [BR("38440000")]: { status: 200, corpo: { cep: "38440000", state: "MG", city: "Araguari", neighborhood: "", street: "" } },
  });
  const r = await buscarCep("38440000", buscar);
  assert.deepEqual(r, { tipo: "cidade", cidade: "Araguari", uf: "MG" });
  assert.equal(mensagemCep(r), "Este CEP é da cidade toda — digite a rua");
});

test("sem rede nas duas → mensagem para preencher à mão", async () => {
  const { buscar } = simular({ [VIA("38400100")]: "rede", [BR("38400100")]: "rede" });
  const r = await buscarCep("38400100", buscar);
  assert.deepEqual(r, { tipo: "sem_rede" });
  assert.equal(mensagemCep(r), "Não conseguimos buscar agora — preencha o endereço abaixo");
});

test("ViaCEP fora do ar e BrasilAPI responde 'não achou' → não encontrado (não é falta de rede)", async () => {
  const { buscar } = simular({ [VIA("12345678")]: "rede", [BR("12345678")]: { status: 404 } });
  assert.deepEqual(await buscarCep("12345678", buscar), { tipo: "nao_encontrado" });
});

test("CEP incompleto não consulta nada", async () => {
  const { buscar, chamadas } = simular({});
  assert.deepEqual(await buscarCep("3840", buscar), { tipo: "nao_encontrado" });
  assert.equal(chamadas.length, 0);
});

test("buscar pelo endereço: até 5 opções com o CEP formatado; dados curtos não consultam", async () => {
  const lista = Array.from({ length: 7 }, (_, i) => ({ cep: `3840010${i}`, logradouro: `Rua Teste ${i}`, bairro: "Centro", localidade: "Uberlândia", uf: "MG" }));
  const url = `${URL_VIACEP}/MG/${encodeURIComponent("Uberlândia")}/${encodeURIComponent("Rua Teste")}/json/`;
  const { buscar, chamadas } = simular({ [url]: { status: 200, corpo: lista } });
  const r = await buscarPorEndereco("mg", "Uberlândia", "Rua Teste", buscar);
  assert.equal(r.opcoes.length, 5);
  assert.equal(r.opcoes[0].cep, "38400-100");
  assert.equal(r.semRede, false);
  assert.deepEqual(await buscarPorEndereco("MG", "Ub", "Rua", buscar), { opcoes: [], semRede: false });
  assert.equal(chamadas.length, 1);
});

test("buscar pelo endereço sem rede avisa", async () => {
  const { buscar } = simular({});
  assert.deepEqual(await buscarPorEndereco("MG", "Uberlândia", "Rua Teste", buscar), { opcoes: [], semRede: true });
});

test("formatarCep", () => {
  assert.equal(formatarCep("38400100"), "38400-100");
  assert.equal(formatarCep("384"), "384");
});
