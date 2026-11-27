/*
  E570 (resíduo, reteste de 05/11) — o aviso de candidatura nova nomeava o imóvel, mas o morador saía sempre
  "Candidato(a)": com 2+ candidaturas no mesmo anúncio, o dono não sabia quem chegou sem abrir. Agora o aviso leva o
  PRIMEIRO nome de exibição do candidato (a mesma regra do e-mail da candidatura, que já o mostra antes do aceite —
  nunca o nome completo), pela fonte única primeiroNome (sem marca de teste, sem e-mail). Sem nome, "Candidato(a)".
  Roda: node --test src/lib/notifications/e570-nome-candidato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tituloAvisoCandidatura } from "./avisos.ts";
import { primeiroNome } from "../display-name.ts";

const IMOVEL = "TESTE QA - Casa mobiliada 2 quartos no Centro";

test("com nome de exibição: 'Nova candidatura de Lucas para …' (só o primeiro nome)", () => {
  assert.equal(tituloAvisoCandidatura({ candidato: primeiroNome("Lucas Andrade Silva"), imovel: IMOVEL }), `Nova candidatura de Lucas para ${IMOVEL}`);
  assert.equal(tituloAvisoCandidatura({ candidato: primeiroNome("[TESTE QA] Lucas Andrade"), imovel: IMOVEL }), `Nova candidatura de Lucas para ${IMOVEL}`);
});

test("sem nome (vazio ou e-mail no lugar do nome): 'Candidato(a)'", () => {
  assert.equal(tituloAvisoCandidatura({ candidato: primeiroNome(null), imovel: IMOVEL }), `Nova candidatura de Candidato(a) para ${IMOVEL}`);
  assert.equal(tituloAvisoCandidatura({ candidato: primeiroNome("lucas@exemplo.com"), imovel: IMOVEL }), `Nova candidatura de Candidato(a) para ${IMOVEL}`);
});

test("a candidatura grava o aviso com o primeiro nome do candidato", () => {
  const a = readFileSync("src/lib/data/actions.ts", "utf8");
  assert.match(a, /tituloAviso: tituloAvisoCandidatura\(\{ candidato: primeiroNome\(me\?\.full_name\), imovel: propertyTitle \}\), refId: leadId/);
});
