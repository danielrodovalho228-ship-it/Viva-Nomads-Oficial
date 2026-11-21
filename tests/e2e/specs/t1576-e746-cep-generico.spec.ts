import { test, expect } from "@playwright/test";
import { buscarCep, ehCepGenerico, mensagemCep, type Buscar } from "../../../src/lib/cep/buscar";

/*
  T1576 — E746 (#3549): CEP genérico de faixa (38400-000) não é "não encontrado": tem saída guiada (UF + digitar a rua). Guarda do caminho
  da busca com respostas simuladas (sem rede): nenhuma base acha o CEP -> "faixa" para os que terminam em 000 (UF conhecida); o resto segue
  "nao_encontrado". Só lógica (sem página), roda no lab-crítico.
*/
const naoAchou: Buscar = async () => ({ ok: true, status: 200, json: async () => ({ erro: true }) });

test("E746: 38400-000 vira 'faixa' de MG com a mensagem de CEP genérico", async () => {
  expect(ehCepGenerico("38400000")).toBe(true);
  const r = await buscarCep("38400-000", naoAchou);
  expect(r).toEqual({ tipo: "faixa", uf: "MG" });
  expect(mensagemCep(r)).toMatch(/gen[ée]rico/i);
});

test("E746: CEP comum que ninguém acha continua 'não encontrado'", async () => {
  expect(ehCepGenerico("38400123")).toBe(false);
  expect(await buscarCep("38400-123", naoAchou)).toEqual({ tipo: "nao_encontrado" });
});
