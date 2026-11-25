/*
  E1081 (ORDEM-DUET-387, classe A — bloqueio do piloto): a prova do Gerente falhou nas pernas 1–2. A página de nível
  dizia "A avaliação ainda não tem valor nesta cidade" porque properties.city = "Uberlândia" (com acento) e
  vistoria_precos.cidade = "Uberlandia" (sem acento), e a leitura do preço filtrava no banco letra a letra
  (.eq("cidade", im.city)). Correção: a leitura da tabela de preço tem UMA fonte (tabelaDaCidade, em servidor.ts), que
  compara com chaveCidade (sem acento, sem maiúsculas). As cidades do credenciamento/rodízio (atendeCidade, E1077-b2)
  e as condições da chave (tabelaCompleta/precoVigente) já comparavam pela chave; ficam presas aqui. Dados gravados
  não mudam.
  Roda: node --test src/lib/vistoria/e1081-cidade-normalizada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { atendeCidade, linhasDaCidade, precoVigente, tabelaCompleta, type LinhaPreco } from "./regras.ts";

const linha = (cidade: string, porte: LinhaPreco["porte"], valor: number): LinhaPreco => ({
  cidade,
  porte,
  valor,
  incluiTexto: null,
  vigenteDesde: "2026-11-01T00:00:00Z",
  retornoDias: null,
  retornoPercentual: null,
});
const agora = new Date("2026-11-21T12:00:00Z");

test("E1081: a tabela gravada como 'Uberlandia' dá o preço ao imóvel de 'Uberlândia' (e o contrário)", () => {
  const tabela = [linha("Uberlandia", "q1_2", 350), linha("Uberaba", "q1_2", 300)];
  assert.deepEqual(linhasDaCidade(tabela, "Uberlândia").map((l) => l.valor), [350]);
  assert.deepEqual(linhasDaCidade([linha("Uberlândia", "q1_2", 350)], "UBERLANDIA").map((l) => l.valor), [350]);
  assert.deepEqual(linhasDaCidade(tabela, "Araguari"), []);
  assert.deepEqual(linhasDaCidade(tabela, ""), []);
  assert.equal(precoVigente(linhasDaCidade(tabela, "Uberlândia"), "Uberlândia", "q1_2", agora)?.valor, 350);
});

test("E1081: as condições da chave e o rodízio comparam pela chave da cidade", () => {
  const tabela = (["estudio", "q1_2", "q3_mais"] as const).map((p) => linha("Uberlandia", p, 400));
  assert.equal(tabelaCompleta(tabela, "Uberlândia", agora), true);
  assert.equal(atendeCidade("Uberlandia, Araguari", "Uberlândia"), true);
  assert.equal(atendeCidade("Uberlândia", "UBERLANDIA"), true);
});

test("E1081: nenhuma leitura de preço filtra a cidade no banco letra a letra — todas passam por tabelaDaCidade", () => {
  for (const f of ["src/components/vistoria/bloco-avaliacao-dono.tsx", "src/lib/vistoria/actions.ts", "src/lib/vistoria/laudo-actions.ts"]) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /from\("vistoria_precos"\)\.select\(COLUNAS_PRECO\)\.eq\("cidade"/, `${f}: leitura letra a letra`);
    assert.match(s, /tabelaDaCidade\((s\.admin|a\.admin|admin), im\.city/, `${f}: usa a fonte única`);
  }
  const srv = readFileSync("src/lib/vistoria/servidor.ts", "utf8");
  assert.match(srv, /export async function tabelaDaCidade[\s\S]*?from\("vistoria_precos"\)\.select\(COLUNAS_PRECO\)[\s\S]*?linhasDaCidade\(/);
  assert.doesNotMatch(srv.slice(srv.indexOf("export async function tabelaDaCidade")), /^[^\n]*\.eq\("cidade"/m);
});
