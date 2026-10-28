/* Roda: node --test src/lib/visitas/visitas-passadas.test.ts — E184 (visita passada e endereço da presencial). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enderecoDaVisita, visitaJaPassou } from "./endereco-visita.ts";

const agora = new Date("2026-10-25T15:00:00Z");

test("confirmada com o horário (mais a folga de 3 h) já passado: horário passou; antes disso, ainda confirmada", () => {
  assert.equal(visitaJaPassou({ status: "confirmado", horarioConfirmado: "2026-10-21T13:00:00Z" }, agora), true);
  assert.equal(visitaJaPassou({ status: "confirmado", horarioConfirmado: "2026-10-25T13:00:00Z" }, agora), false);
  assert.equal(visitaJaPassou({ status: "confirmado", horarioConfirmado: "2026-10-26T13:00:00Z" }, agora), false);
  assert.equal(visitaJaPassou({ status: "pedido", horarioConfirmado: null }, agora), false);
  assert.equal(visitaJaPassou({ status: "cancelado", horarioConfirmado: "2026-10-21T13:00:00Z" }, agora), false);
});

test("endereço da presencial: a linha exata vale; sem ela, rua, número e complemento do cadastro", () => {
  const base = { address: "Saraiva", city: "Uberlândia", state: "MG" };
  assert.equal(enderecoDaVisita({ ...base, exact_address: "Rua A, 10" })?.texto, "Rua A, 10 · Saraiva · Uberlândia");
  assert.equal(enderecoDaVisita({ ...base, exact_address: "", draft_data: { street: "Rua B", numero: "20", complemento: "apto 3" } })?.texto, "Rua B, 20, apto 3 · Saraiva · Uberlândia");
  assert.equal(enderecoDaVisita({ ...base, exact_address: null, draft_data: {} }), null);
});

test("cartão: sem cancelar o que já passou; confirmada sem endereço não promete 'quando for confirmada'", () => {
  const tela = readFileSync("src/components/visitas/cartao-visita.tsx", "utf8");
  assert.match(tela, /\{!passou && \(\s*<Button[^>]*data-testid="visita-cancelar"/);
  assert.match(tela, /passou \? null : <AcoesMorador/);
  assert.match(tela, /data-testid="visita-endereco-pendente"/);
});
