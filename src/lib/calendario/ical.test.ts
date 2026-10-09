/* Calendário (7f905568, parte 1): .ics só com "Ocupado" e link secreto. Roda: node --test src/lib/calendario/ical.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarIcs, tokenCalendario, tokenCalendarioValido } from "./ical.ts";

const ID = "11111111-2222-3333-4444-555555555555";
const AGORA = new Date("2026-10-09T12:00:00Z");

test("gera um evento 'Ocupado' por contrato, sem dado do inquilino", () => {
  const ics = gerarIcs(ID, [{ inicio: "2026-11-01", fim: "2026-12-01" }], AGORA);
  assert.match(ics, /DTSTART;VALUE=DATE:20261101/);
  assert.match(ics, /DTEND;VALUE=DATE:20261201/);
  assert.match(ics, /SUMMARY:Ocupado/);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR") && ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.ok(ics.includes("\r\n"));
});

test("caso negativo: datas inválidas ou fim antes do início são ignoradas", () => {
  const ics = gerarIcs(ID, [{ inicio: "2026-12-01", fim: "2026-11-01" }, { inicio: "x", fim: "2026-11-01" }, { inicio: "2026-11-01", fim: "2026-11-01" }], AGORA);
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
});

test("token: vale só para o mesmo imóvel e segredo; sem segredo não existe", () => {
  const t = tokenCalendario(ID, "s1");
  assert.ok(t);
  assert.equal(tokenCalendarioValido(ID, t, "s1"), true);
  assert.equal(tokenCalendarioValido(ID, t, "s2"), false);
  assert.equal(tokenCalendarioValido("outro-imovel", t, "s1"), false);
  assert.equal(tokenCalendarioValido(ID, "curto", "s1"), false);
  assert.equal(tokenCalendarioValido(ID, 5, "s1"), false);
  assert.equal(tokenCalendario(ID, ""), null);
});
