/*
  E399-C, pacote 4 — com a chave PRECO_JUSTO_COMPARADOR, o RANKING usa o selo do motor (o mesmo do cartão e da ficha)
  e o motivo explica a regra nova (30 noites no Airbnb). Sem a chave, nada muda (coluna da 0277 e o motivo antigo).
  Roda: node --test src/lib/comparador-airbnb/pacote4.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sinaisDaLinha, type LinhaRankingSinais } from "../ranking/sinais.ts";
import { selosDoAnuncio } from "../ranking/ordem.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const linha = (precoJusto: boolean) => ({ id: "x", dono_id: "d", titulo: "Studio", preco_justo: precoJusto }) as unknown as LinhaRankingSinais;

test("sem a chave: vale a coluna da 0277 e o motivo antigo", () => {
  const s = sinaisDaLinha(linha(true), { identidadeConfirmada: false });
  assert.equal(s.precoJusto, true);
  assert.equal(s.precoJustoMotor, false);
  const motivo = selosDoAnuncio(s).find((x) => x.codigo === "preco_justo")?.motivo ?? "";
  assert.match(motivo, /informado pelo proprietário/);
});

test("com a chave: o selo do motor vence a coluna (nos dois sentidos) e o motivo fala de 30 noites no Airbnb", () => {
  const ganha = sinaisDaLinha(linha(false), { identidadeConfirmada: false, precoJustoMotor: true });
  assert.equal(ganha.precoJusto, true);
  assert.match(selosDoAnuncio(ganha).find((x) => x.codigo === "preco_justo")?.motivo ?? "", /30 noites do mesmo imóvel no Airbnb/);
  const perde = sinaisDaLinha(linha(true), { identidadeConfirmada: false, precoJustoMotor: false });
  assert.equal(perde.precoJusto, false);
  assert.equal(selosDoAnuncio(perde).some((x) => x.codigo === "preco_justo"), false);
});

test("servidor: o ranking só lê o motor com a chave; sem leitura, ninguém ganha", () => {
  const r = ler("src/lib/data/ranking.ts");
  assert.match(r, /PRECO_JUSTO_COMPARADOR \? selosDoMotor\(admin, reais, new Date\(\)\)\.catch\(\(\) => new Set<string>\(\)\) : Promise\.resolve\(null\)/);
  assert.match(r, /\.\.\.\(selosMotor \? \{ precoJustoMotor: selosMotor\.has\(l\.id\) \} : \{\}\)/);
  const srv = ler("src/lib/comparador-airbnb/comparacao-servidor.ts");
  assert.match(srv, /export async function selosDoMotor\(/);
  assert.doesNotMatch(srv.slice(srv.indexOf("export async function selosDoMotor")), /airbnb_id/);
});
