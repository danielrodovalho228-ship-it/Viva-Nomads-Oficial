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

// ── Prompt 53 ─────────────────────────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import {
  LIMITE_LINKS_POR_IMOVEL,
  avisarFalha,
  causaDaFalha,
  conflitosComViva,
  dominioDoLink,
  origemDoLink,
  planoDeSincronia,
  precisaLer,
  tipoDeCalendario,
} from "./importar.ts";
import { gerarIcs } from "./ical.ts";

const fixture = (n: string) => readFileSync(new URL(`../../../tests/fixtures/ical/${n}`, import.meta.url), "utf8");

test("53: .ics reais de exemplo — Airbnb (reserva + bloqueio, sem dado de hóspede) e Booking (1 noite)", () => {
  const a = lerIcs(fixture("airbnb.ics"));
  assert.deepEqual(a.ok && a.bloqueios, [
    { inicio: "2026-12-01", fim: "2026-12-04" },
    { inicio: "2027-01-02", fim: "2027-01-09" },
  ]);
  assert.doesNotMatch(JSON.stringify(a), /HMABCD|1234|Reserved/);
  const b = lerIcs(fixture("booking.ics"));
  assert.deepEqual(b.ok && b.bloqueios, [{ inicio: "2026-12-15", fim: "2026-12-15" }]);
});

test("53: ida e volta com a nossa exportação — DTEND exclusivo dos dois lados", () => {
  const ics = gerarIcs("p1", [{ inicio: "2026-11-10", fim: "2026-11-20" }], new Date("2026-10-23T12:00:00Z"));
  const r = lerIcs(ics);
  // A exportação diz "sai no dia 20" (noite do 20 livre) → aqui o último dia ocupado é 19.
  assert.deepEqual(r.ok && r.bloqueios, [{ inicio: "2026-11-10", fim: "2026-11-19" }]);
});

test("53: origem, domínio (o link inteiro não volta à tela), tipo da resposta e limite de 3 links", () => {
  assert.equal(origemDoLink("https://www.airbnb.com.br/calendar/ical/123.ics?s=abc"), "airbnb");
  assert.equal(origemDoLink("https://admin.booking.com/hotel/hoteladmin/ical.html?t=x"), "booking");
  assert.equal(origemDoLink("https://www.vrbo.com/icalendar/x.ics"), "vrbo");
  assert.equal(origemDoLink("https://calendar.google.com/x.ics"), "outro");
  assert.equal(dominioDoLink("https://www.airbnb.com.br/calendar/ical/123.ics?s=segredo"), "airbnb.com.br");
  assert.doesNotMatch(dominioDoLink("https://www.airbnb.com.br/calendar/ical/123.ics?s=segredo"), /segredo|123/);
  assert.equal(tipoDeCalendario("text/calendar; charset=utf-8"), true);
  assert.equal(tipoDeCalendario("text/html"), false);
  assert.equal(tipoDeCalendario(null), false);
  assert.equal(LIMITE_LINKS_POR_IMOVEL, 3);
});

test("53: sincronia — entra o novo, sai o removido lá (libera a data), passado não entra, manual nunca é tocado", () => {
  const atuais = [
    { id: "a", inicio: "2026-12-01", fim: "2026-12-04" },
    { id: "b", inicio: "2026-12-20", fim: "2026-12-22" },
  ];
  const lidos = [
    { inicio: "2026-12-01", fim: "2026-12-04" },
    { inicio: "2027-01-02", fim: "2027-01-09" },
    { inicio: "2026-09-01", fim: "2026-09-05" },
  ];
  const p = planoDeSincronia(atuais, lidos, "2026-10-23");
  assert.deepEqual(p.inserir, [{ inicio: "2027-01-02", fim: "2027-01-09" }]);
  assert.deepEqual(p.apagar, ["b"], "o que sumiu do outro site é liberado aqui");
  // Os bloqueios manuais não estão na lista desta importação: a sincronia não tem como apagá-los.
  const acao = readFileSync(new URL("./importar-servidor.ts", import.meta.url), "utf8");
  assert.match(acao, /\.delete\(\)\.in\("id", plano\.apagar\)\.eq\("importacao_id", imp\.id\)/);
  assert.match(acao, /\.select\("id, inicio, fim"\)\.eq\("importacao_id", imp\.id\)/);
});

test("53: conflito com compromisso da Viva só avisa (nada é cancelado)", () => {
  const c = conflitosComViva(
    [{ inicio: "2026-12-01", fim: "2026-12-04" }],
    [
      { inicio: "2026-11-20", fim: "2026-12-02", tipo: "contrato" },
      { inicio: "2027-02-01", fim: "2027-02-28", tipo: "proposta" },
    ],
  );
  assert.equal(c.length, 1);
  assert.equal(c[0].compromisso.tipo, "contrato");
  const servidor = readFileSync(new URL("./importar-servidor.ts", import.meta.url), "utf8");
  assert.doesNotMatch(servidor, /from\("(contratos|propostas|leads)"\)[^;]*\.(update|delete)\(/, "a importação nunca mexe em contrato, proposta ou candidatura");
  assert.match(servidor, /"calendario_conflito"/);
});

test("53: 3 falhas seguidas avisam o dono uma vez, com a causa em palavras dele", () => {
  assert.deepEqual([1, 2, 3, 4].map(avisarFalha), [false, false, true, false]);
  assert.equal(causaDaFalha("HTTP 404", "airbnb"), "O link deixou de responder: gere um novo no Airbnb e cole aqui.");
  assert.match(causaDaFalha("a resposta não é um calendário (.ics)", "booking"), /link de exportação \(\.ics\) no Booking/);
  const agora = new Date("2026-10-23T12:00:00Z");
  assert.equal(precisaLer(null, agora), true);
  assert.equal(precisaLer("2026-10-23T10:00:00Z", agora), false);
  assert.equal(precisaLer("2026-10-23T09:00:00Z", agora), true);
});
