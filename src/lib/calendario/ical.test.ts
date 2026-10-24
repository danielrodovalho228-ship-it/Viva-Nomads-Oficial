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

// E44: o que a exportação publica e o link do dono.
import { ocupacoesDaExportacao, urlExportacaoCalendario } from "./ical.ts";
import { readFileSync } from "node:fs";

test("E44: exporta contratos e bloqueios MANUAIS (último dia incluso); importado de outro site não volta para fora", () => {
  const o = ocupacoesDaExportacao({
    contratos: [{ inicio: "2026-12-01", fim: "2027-01-01" }],
    bloqueios: [
      { inicio: "2026-11-10", fim: "2026-11-12", origem: "manual" },
      { inicio: "2026-11-20", fim: "2026-11-20" },
      { inicio: "2026-11-25", fim: "2026-11-28", origem: "importado" },
      { inicio: "2026-11-30", fim: "2026-11-29", origem: "manual" },
    ],
  });
  assert.deepEqual(o, [
    { inicio: "2026-11-10", fim: "2026-11-13" },
    { inicio: "2026-11-20", fim: "2026-11-21" },
    { inicio: "2026-12-01", fim: "2027-01-01" },
  ]);
  const ics = gerarIcs(ID, o, AGORA);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3);
  assert.match(ics, /DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121/);
  assert.doesNotMatch(ics, /20261125/, "o importado não sai");
  // UID único por período (início e fim), mesmo com dois eventos no mesmo dia de início.
  const dois = gerarIcs(ID, [{ inicio: "2026-11-01", fim: "2026-11-05" }, { inicio: "2026-11-01", fim: "2026-11-09" }], AGORA);
  const uids = dois.match(/UID:[^\r]+/g) ?? [];
  assert.equal(new Set(uids).size, 2);
});

test("E44: link do dono = site + /api/calendario/<imóvel>/<token>.ics; sem segredo, sem link", () => {
  const url = urlExportacaoCalendario("https://vivanomads.com.br/", ID, "s1");
  assert.equal(url, `https://vivanomads.com.br/api/calendario/${ID}/${tokenCalendario(ID, "s1")}.ics`);
  assert.equal(urlExportacaoCalendario("https://x", ID, ""), null);
});

test("E44: rota publica os bloqueios; ação só entrega o link ao dono; editor e cadastro mostram grade + exportar", () => {
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const rota = ler("app/api/calendario/[id]/[token]/route.ts");
  assert.match(rota, /from\("property_blocks"\)\.select\("inicio, fim, origem"\)/);
  assert.match(rota, /ocupacoesDaExportacao\(/);
  const acoes = ler("lib/data/blocks-actions.ts");
  assert.match(acoes, /export async function linkExportacaoCalendario/);
  assert.match(acoes, /\.eq\("owner_id", user\.id\)/);
  const cal = ler("components/property/block-calendar.tsx");
  assert.match(cal, /<ExportarCalendario propertyId=\{propertyId\} \/>/);
  assert.match(cal, /data-testid="calendario-dono-grade"/);
  const etapa = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
  assert.match(etapa, /<BlockCalendar propertyId=\{p\.imovelId\} \/>/);
  assert.match(ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx"), /imovelId=\{imovelId\}/);
});
