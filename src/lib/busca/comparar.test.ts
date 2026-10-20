import test from "node:test";
import assert from "node:assert/strict";
import { alternarSelecao, hrefComparar, idsDeComparar, montarTabela, AVISO_LIMITE, SEM_DADO } from "./comparar.ts";
import type { Property } from "../types.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";

const imovel = (o: Partial<Property>) => ({ monthlyPrice: 0, bedrooms: 0, bathrooms: 0, areaM2: 0, prepFee: 0, rating: 0, reviewCount: 0, ...o }) as Property;

test("limite de 3: o 4º não entra e vem o aviso amigável", () => {
  const r = alternarSelecao([A, B, C], D);
  assert.deepEqual(r.ids, [A, B, C]);
  assert.equal(r.aviso, AVISO_LIMITE);
  assert.deepEqual(alternarSelecao([A, B, C], B).ids, [A, C]);
  assert.equal(alternarSelecao([A], B).aviso, null);
});

test("a URL só aceita ids válidos, sem repetir, no máximo 3", () => {
  assert.deepEqual(idsDeComparar(`${A},${A},lixo,<script>,${B},${C},${D}`), [A, B, C]);
  assert.deepEqual(idsDeComparar(undefined), []);
  assert.equal(hrefComparar([A, B]), `/comparar?comparar=${A},${B}`);
});

test("ids de anúncio de exemplo (ube-001) e a seleção mista valem; texto fora do padrão não", () => {
  assert.deepEqual(idsDeComparar("ube-001,ube-002"), ["ube-001", "ube-002"]);
  assert.deepEqual(idsDeComparar(`ube-015,${A},ube-015`), ["ube-015", A]);
  assert.deepEqual(idsDeComparar("ube-1,ube-0001,UBE-001,ube-001x,ube-00a,../ube-001,ube-001;drop"), []);
  assert.deepEqual(idsDeComparar("ube-001,ube-002,ube-003,ube-004"), ["ube-001", "ube-002", "ube-003"]);
  assert.equal(hrefComparar(["ube-001", "ube-002"]), "/comparar?comparar=ube-001,ube-002");
});

test("tabela: campo sem dado vira '—', nunca inventa", () => {
  const t = montarTabela([imovel({ monthlyPrice: 3200, bedrooms: 2, rating: 4.5, reviewCount: 8, petsAllowed: true, petsRegras: { especies: ["cao"], porteMax: "M", qtdMax: 1, reforcoCaucao: 500, regrasCondominio: "", valorPet: 300, valorPetTipo: "reembolsavel" } }), imovel({})]);
  const l = Object.fromEntries(t.map((x) => [x.chave, x.valores]));
  assert.deepEqual(l.mensal, ["R$ 3.200", SEM_DADO]);
  assert.deepEqual(l.quartos, ["2", SEM_DADO]);
  assert.deepEqual(l.avaliacao, ["4,5 (8)", SEM_DADO]);
  assert.deepEqual(l.pet, ["Sim", SEM_DADO]);
  assert.match(l.valorPet[0], /Caução pet R\$ 300,00/);
  assert.equal(l.valorPet[1], SEM_DADO);
  assert.match(l.caucao[0], /R\$ 500/);
  assert.ok(t.every((x) => x.valores.length === 2));
});

test("Caução: sem reforço pet mostra as garantias aceitas; com reforço mostra o reforço", () => {
  const t = montarTabela([
    imovel({ garantiasAceitas: ["caucao_avista", "seguro_fianca"] }),
    imovel({ garantiasAceitas: ["caucao_avista"], petsRegras: { especies: ["cao"], porteMax: "M", qtdMax: 1, reforcoCaucao: 500, regrasCondominio: "", valorPet: 0, valorPetTipo: "reembolsavel" } }),
    imovel({}),
  ]);
  const c = t.find((x) => x.chave === "caucao")!.valores;
  assert.equal(c[0], "Caução à vista, Seguro-fiança");
  assert.match(c[1], /Reforço de R\$ 500/);
  assert.equal(c[2], SEM_DADO);
});
