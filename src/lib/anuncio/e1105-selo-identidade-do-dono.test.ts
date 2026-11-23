/*
  E1105 (ORDEM-DUET-472/476/477): o selo de identidade do dono na PÁGINA DO IMÓVEL, lido da fonte única
  (estadoIdentidade, E748) — só no estado `confirmada`, com o texto da própria fonte. Precedência, nunca os dois:
  confirmada → o selo de identidade, e o "Dono verificado" (manual, profiles.is_verified) não aparece; não confirmada
  com is_verified → o "Dono verificado" exactamente como hoje; nenhum dos dois → nenhum selo. `em_breve` (o estado por
  omissão de toda a conta real sem laudo), `vencida` e `indisponivel` não dão selo de identidade. Fora do cartão de
  resultados (E899): só na página do imóvel. Nenhum estado da fonte é redefinido.
  Roda: node --test src/lib/anuncio/e1105-selo-identidade-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoIdentidadeDe, IDENTIDADE_INDISPONIVEL } from "../identidade/estado.ts";
import { identidadeConfirmadaDoDono, seloDoDono } from "./dono-verificado.ts";

const AGORA = new Date("2026-10-19T12:00:00Z");
const laudo = (valid_until: string) => ({
  caf_result: { identity: true, document: true, liveness: true, light: "green" },
  traffic_light: "green",
  valid_until,
  created_at: "2026-10-18T15:00:00Z",
});
const CONFIRMADA = estadoIdentidadeDe(laudo("2027-10-18T15:00:00Z"), false, AGORA);
const VENCIDA = estadoIdentidadeDe(laudo("2026-10-10T15:00:00Z"), false, AGORA);
const EM_BREVE = estadoIdentidadeDe(null, false, AGORA);
const real = (verified: boolean) => ({ id: "11111111-1111-4111-8111-111111111111", owner: { verified } }) as never;

test("E1105: só `confirmada` dá o texto do selo — o da própria fonte; em_breve, vencida e indisponivel não", () => {
  assert.equal(CONFIRMADA.estado, "confirmada");
  assert.equal(identidadeConfirmadaDoDono(CONFIRMADA), CONFIRMADA.texto);
  assert.equal(identidadeConfirmadaDoDono(CONFIRMADA), "Identidade confirmada · válida até 18/10/2027");
  assert.equal(EM_BREVE.estado, "em_breve");
  assert.equal(identidadeConfirmadaDoDono(EM_BREVE), null, "em_breve é o estado por omissão da conta real sem laudo: sem selo");
  assert.equal(identidadeConfirmadaDoDono(VENCIDA), null);
  assert.equal(identidadeConfirmadaDoDono(IDENTIDADE_INDISPONIVEL), null);
  assert.equal(identidadeConfirmadaDoDono(null), null);
});

test("E1105: precedência — confirmada suprime o manual; sem confirmação, o 'Dono verificado' como hoje; nunca os dois", () => {
  const texto = identidadeConfirmadaDoDono(CONFIRMADA);
  assert.deepEqual(seloDoDono(real(true), texto), { tipo: "identidade", texto }, "confirmada + is_verified: só o de identidade");
  assert.deepEqual(seloDoDono(real(false), texto), { tipo: "identidade", texto }, "confirmada sem is_verified: o de identidade");
  assert.deepEqual(seloDoDono(real(true), identidadeConfirmadaDoDono(EM_BREVE)), { tipo: "manual" }, "não confirmada + is_verified: 'Dono verificado'");
  assert.equal(seloDoDono(real(false), identidadeConfirmadaDoDono(EM_BREVE)), null, "em_breve sem is_verified: nenhum selo");
  assert.equal(seloDoDono(real(false), identidadeConfirmadaDoDono(VENCIDA)), null);
  assert.deepEqual(seloDoDono(real(true), null), { tipo: "manual" }, "is_verified sozinho continua só o manual");
  assert.equal(seloDoDono({ id: "exemplo-1", owner: { verified: true } } as never, texto), null, "anúncio de exemplo: nunca");
});

test("E1105: a página do imóvel desenha um selo só, pela regra; o servidor lê a fonte única; fora do cartão de resultados", () => {
  const cartao = readFileSync("src/components/property/owner-card.tsx", "utf8");
  assert.match(cartao, /const selo = seloDoDono\(property, proprietario\?\.identidadeConfirmada\);/);
  assert.match(cartao, /selo\?\.tipo === "identidade" &&[\s\S]*?<SeloIdentidadeDono texto=\{selo\.texto\} \/>/);
  assert.match(cartao, /selo\?\.tipo === "manual" &&[\s\S]*?<SeloDonoVerificado \/>/);
  assert.doesNotMatch(cartao, /donoVerificado\(property\)/, "o manual só entra pela regra de precedência");
  const perfil = readFileSync("src/lib/data/perfil-proprietario.ts", "utf8");
  assert.match(perfil, /identidadeConfirmada: identidadeConfirmadaDoDono\(await estadoIdentidade\(admin, donoId\)\.catch\(\(\) => null\)\)/);
  const selo = readFileSync("src/components/property/selo-identidade-dono.tsx", "utf8");
  assert.doesNotMatch(selo, /Identidade confirmada|Conferida pela equipe/, "o texto vem da fonte, nunca escrito no componente");
  // E899: o cartão de resultados só leva o essencial — nem o selo de identidade, nem a regra.
  assert.doesNotMatch(readFileSync("src/components/property-card.tsx", "utf8"), /SeloIdentidadeDono|seloDoDono|identidadeConfirmada/);
});
