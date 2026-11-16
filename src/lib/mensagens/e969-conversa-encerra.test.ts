/*
  E969 — a conversa encerra (regra do coordenador). Roda: node --test src/lib/mensagens/e969-conversa-encerra.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encerraComContrato, estadoDaConversa, textoConversaEncerrada, textoNovaCandidatura } from "./encerramento.ts";
import { DIAS_PRAZO_AVALIACAO } from "../avaliacoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E969 — sem contrato: candidatura recusada (ou expirada/cancelada) encerra no dia em que terminou", () => {
  const e = estadoDaConversa([{ criadaEm: "2026-11-01T10:00:00Z", status: "rejected", terminouEm: "2026-11-03T15:00:00Z" }], "2026-11-04");
  assert.deepEqual(e, { encerradaEm: "2026-11-03", novasCandidaturas: [] });
  assert.equal(estadoDaConversa([{ criadaEm: "2026-11-01", status: "expired", terminouEm: "2026-11-05" }], "2026-11-06").encerradaEm, "2026-11-05");
  // Em aberto ou aceita sem contrato: não encerra.
  assert.equal(estadoDaConversa([{ criadaEm: "2026-11-01", status: "new" }], "2027-01-01").encerradaEm, null);
  assert.equal(estadoDaConversa([{ criadaEm: "2026-11-01", status: "accepted" }], "2027-01-01").encerradaEm, null);
  assert.equal(estadoDaConversa([], "2027-01-01").encerradaEm, null);
});

test("E969 — candidatura nova reabre a mesma conversa, com o separador", () => {
  const e = estadoDaConversa(
    [
      { criadaEm: "2026-11-10T09:00:00Z", status: "new" },
      { criadaEm: "2026-11-01T10:00:00Z", status: "rejected", terminouEm: "2026-11-03" },
    ],
    "2026-11-11",
  );
  assert.deepEqual(e, { encerradaEm: null, novasCandidaturas: ["2026-11-10T09:00:00Z"] });
  assert.equal(textoNovaCandidatura("2026-11-10T09:00:00Z"), "Nova candidatura em 10/11/2026");
  assert.equal(textoConversaEncerrada("2026-11-03"), "Esta conversa foi encerrada em 03/11/2026. O histórico continua disponível.");
});

test("E969 — com contrato: o último entre o fim da caução e o fim da estadia + DIAS_PRAZO_AVALIACAO (sem piso de 30)", () => {
  const fim = "2026-12-01";
  assert.equal(DIAS_PRAZO_AVALIACAO, 14);
  assert.equal(encerraComContrato({ fimEstadia: fim, comCaucao: true, fimProcessoCaucao: "2026-12-09" }), "2026-12-15"); // dia 8 → 14
  assert.equal(encerraComContrato({ fimEstadia: fim, comCaucao: true, fimProcessoCaucao: "2026-12-26" }), "2026-12-26"); // dia 25 → 25
  assert.equal(encerraComContrato({ fimEstadia: fim, comCaucao: false, fimProcessoCaucao: null }), "2026-12-15");
  assert.equal(encerraComContrato({ fimEstadia: fim, comCaucao: true, fimProcessoCaucao: null }), null);
  // Antes do dia, a conversa segue aberta; no dia, encerra.
  const c = { criadaEm: "2026-10-01", status: "accepted", contrato: { fimEstadia: fim, comCaucao: true, fimProcessoCaucao: "2026-12-09" } };
  assert.equal(estadoDaConversa([c], "2026-12-14").encerradaEm, null);
  assert.equal(estadoDaConversa([c], "2026-12-15").encerradaEm, "2026-12-15");
});

test("E969 — o prazo vem da constante (nenhum 14 nem 30 escrito à mão)", () => {
  const src = ler("lib/mensagens/encerramento.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /\b(14|30)\b/);
  assert.match(src, /DIAS_PRAZO_AVALIACAO/);
});

test("E969 — a lista de conversas leva o estado, a tela mostra a faixa sem o campo e o envio é recusado", () => {
  assert.match(ler("lib/data/messages.ts"), /estadosDasConversas\(/);
  assert.match(ler("lib/data/encerramento-conversas.ts"), /estadoDaConversa\(cands, hoje\)/);
  const tela = ler("app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  assert.match(tela, /data-testid="conversa-encerrada"/);
  assert.match(tela, /textoConversaEncerrada\(/);
  assert.match(tela, /textoNovaCandidatura\(/);
  assert.match(ler("lib/data/actions.ts"), /MSG_CONVERSA_ENCERRADA/);
});
