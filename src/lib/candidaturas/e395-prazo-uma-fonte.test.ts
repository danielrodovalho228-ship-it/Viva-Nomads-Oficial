/*
  E395 — o prazo do proprietário desde o envio vem de UMA fonte (PRAZO_RESPOSTA_DONO). A trava t2048 da Pista 3 confere
  que o texto está nas 4 superfícies; este teste confere que é o MESMO texto da constante (as duas superfícies escritas
  por extenso não podem divergir dela) e que o "1 dia útil" é o do relógio do dono.
  Roda: node --test src/lib/candidaturas/e395-prazo-uma-fonte.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZO_RESPOSTA_DONO, PROXIMO_PASSO_CANDIDATURA } from "./status.ts";
import { aberturaCandidatura, proximoPassoCandidatura } from "../notifications/dados-candidatura.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const IMOVEL = { id: "x", titulo: "Studio", bairro: null, cidade: "Uberlândia" };

test("E395 — a constante é o relógio do dono (1 dia útil)", () => {
  assert.equal(PRAZO_RESPOSTA_DONO, "em até 1 dia útil");
  assert.match(ler("lib/propostas/pre-aceitacao.ts"), /Relógio do dono \(E395\): 1 DIA ÚTIL/);
});

test("E395 — cartões e e-mails usam a constante; as superfícies por extenso repetem exatamente o mesmo texto", () => {
  assert.ok(PROXIMO_PASSO_CANDIDATURA.enviada!.agora.includes(PRAZO_RESPOSTA_DONO));
  assert.ok(PROXIMO_PASSO_CANDIDATURA.em_analise!.agora.includes(PRAZO_RESPOSTA_DONO));
  assert.ok(aberturaCandidatura("enviada", { nome: "Ana", imovel: IMOVEL }).includes(PRAZO_RESPOSTA_DONO));
  assert.ok(proximoPassoCandidatura("nova").includes(PRAZO_RESPOSTA_DONO));
  const detalhe = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  assert.equal(detalhe.split(PRAZO_RESPOSTA_DONO).length - 1, 2, "as duas confirmações 'Candidatura enviada'");
  assert.ok(ler("app/(dashboard)/dashboard/candidaturas/page.tsx").includes(PRAZO_RESPOSTA_DONO));
  // Nenhuma outra grafia do prazo nas superfícies do envio.
  for (const f of ["lib/candidaturas/status.ts", "lib/notifications/dados-candidatura.ts", "app/(public)/imoveis/[id]/property-detail.tsx"]) {
    assert.doesNotMatch(ler(f), /(24 ?h|um dia útil|2 dias úteis|48 ?h)/i, f);
  }
});
