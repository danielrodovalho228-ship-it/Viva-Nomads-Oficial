/* Calendário (7f905568 / 7d961c3e, importação, base pura). Roda: node --test src/lib/calendario/importar.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerIcs, urlIcalPermitida, LIMITE_EVENTOS_ICS } from "./importar.ts";

const cal = (...eventos: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...eventos, "END:VCALENDAR"].join("\r\n");
const ev = (...l: string[]) => ["BEGIN:VEVENT", ...l, "END:VEVENT"].join("\r\n");

test("lê datas: DTEND é exclusivo, então o último dia ocupado é o anterior", () => {
  const r = lerIcs(cal(ev("DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261105")));
  assert.deepEqual(r, { ok: true, bloqueios: [{ inicio: "2026-11-01", fim: "2026-11-04" }] });
});

test("aceita data-hora, evento de 1 dia e DTEND ausente", () => {
  const r = lerIcs(cal(ev("DTSTART:20261201T150000Z", "DTEND:20261203T110000Z"), ev("DTSTART;VALUE=DATE:20261210")));
  assert.deepEqual(r.ok && r.bloqueios, [
    { inicio: "2026-12-01", fim: "2026-12-02" },
    { inicio: "2026-12-10", fim: "2026-12-10" },
  ]);
});

test("privacidade: nome e contato de hóspede não saem da leitura", () => {
  const r = lerIcs(cal(ev("DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261103", "SUMMARY:Maria Silva", "DESCRIPTION:Tel +55 11 99999-0000")));
  assert.doesNotMatch(JSON.stringify(r), /Maria|99999/);
});

test("ignora CANCELLED, data impossível e junta linhas dobradas", () => {
  const r = lerIcs(
    cal(
      ev("DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261103", "STATUS:CANCELLED"),
      ev("DTSTART;VALUE=DATE:20261331"),
      ev("DTSTART;VALUE=DA", " TE:20270105", "DTEND;VALUE=DATE:20270107"),
    ),
  );
  assert.deepEqual(r.ok && r.bloqueios, [{ inicio: "2027-01-05", fim: "2027-01-06" }]);
});

test("caso negativo: texto que não é calendário, vazio e grande demais", () => {
  assert.equal(lerIcs("<html>oi</html>").ok, false);
  assert.equal(lerIcs(null).ok, false);
  assert.equal(lerIcs("BEGIN:VCALENDAR\n" + "x".repeat(1_000_001)).ok, false);
  const muitos = Array.from({ length: LIMITE_EVENTOS_ICS + 1 }, () => ev("DTSTART;VALUE=DATE:20261101"));
  assert.equal(lerIcs(cal(...muitos)).ok, false);
});

test("link: aceita https público e converte webcal", () => {
  assert.deepEqual(urlIcalPermitida("https://www.airbnb.com.br/calendar/ical/123.ics?s=abc"), { ok: true, url: "https://www.airbnb.com.br/calendar/ical/123.ics?s=abc" });
  const w = urlIcalPermitida("webcal://ical.booking.com/v1/export?t=abc");
  assert.ok(w.ok && w.url.startsWith("https://ical.booking.com/"));
});

test("caso negativo do link: http, rede interna, IP, porta, senha e lixo são recusados", () => {
  for (const u of [
    "http://airbnb.com/a.ics",
    "https://localhost/a.ics",
    "https://127.0.0.1/a.ics",
    "https://169.254.169.254/latest",
    "https://[::1]/a.ics",
    "https://intranet/a.ics",
    "https://servidor.internal/a.ics",
    "https://airbnb.com:8443/a.ics",
    "https://user:pass@airbnb.com/a.ics",
    "ftp://airbnb.com/a.ics",
    "não é link",
    "",
    42,
  ]) {
    assert.equal(urlIcalPermitida(u).ok, false, String(u));
  }
});
