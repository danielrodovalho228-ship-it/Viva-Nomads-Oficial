/*
  E1115 (ORDEM-DUET-503; achados R4 e R7 da auditoria dos relógios, ORDEM-502 §3): uma só fonte do "hoje em Brasília",
  `hojeEmBrasilia` em `src/lib/datas-brasilia.ts`, baseada na conversão de fuso de verdade (`diaBRT`), não na subtracção
  fixa de −3 h. As duas implementações antigas (`checkin.ts` com −3 h; `data/estadia.ts` com `diaBRT`) passam a ser a
  mesma função, e as superfícies do R4 deixam de calcular o "hoje" em UTC.
  Roda: node --test src/lib/e1115-hoje-em-brasilia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diaBRT, hojeEmBrasilia } from "./datas-brasilia.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E1115: a fonte única dá o dia de Brasília — também entre as 21:00 e as 24:00 (quando em UTC já é amanhã)", () => {
  // 22/11/2026 23:30 em Brasília = 23/11/2026 02:30 UTC.
  assert.equal(hojeEmBrasilia(new Date("2026-11-23T02:30:00Z")), "2026-11-22");
  assert.equal(hojeEmBrasilia(new Date("2026-11-23T00:00:00Z")), "2026-11-22"); // 21:00 em Brasília
  assert.equal(hojeEmBrasilia(new Date("2026-11-23T02:59:59Z")), "2026-11-22"); // 23:59:59
  assert.equal(hojeEmBrasilia(new Date("2026-11-23T03:00:00Z")), "2026-11-23"); // 00:00 em Brasília
  assert.equal(hojeEmBrasilia(new Date("2026-11-22T12:00:00Z")), "2026-11-22");
  // É a conversão de fuso (diaBRT), não uma conta à parte.
  for (const iso of ["2026-11-23T02:30:00Z", "2026-02-15T01:00:00Z", "2026-07-01T23:59:00Z"]) assert.equal(hojeEmBrasilia(new Date(iso)), diaBRT(iso));
  // Sem argumento, usa o agora.
  assert.match(hojeEmBrasilia(), /^\d{4}-\d{2}-\d{2}$/);
});

test("E1115: datas-brasilia.ts é a fonte; checkin.ts e data/estadia.ts reexportam-na (sem −3 h fixas, sem segunda conta)", () => {
  const fonte = ler("src/lib/datas-brasilia.ts");
  assert.match(fonte, /export function hojeEmBrasilia\(agora: Date = new Date\(\)\): string \{[\s\S]*?diaBRT\(agora\)/);
  const checkin = semComentarios(ler("src/lib/checkin.ts"));
  assert.match(checkin, /export \{ hojeEmBrasilia \} from "\.\/datas-brasilia\.ts";/);
  assert.doesNotMatch(checkin, /function hojeEmBrasilia/);
  assert.doesNotMatch(checkin, /3 \* 3600_?000/);
  const estadia = semComentarios(ler("src/lib/data/estadia.ts"));
  assert.match(estadia, /export \{ hojeEmBrasilia \} from "@\/lib\/datas-brasilia";/);
  assert.doesNotMatch(estadia, /function hojeEmBrasilia/);
});

test("E1115 (R4): o reembolso e o 'disponível a partir de' do anúncio leem o hoje da fonte — nenhum hoje em UTC", () => {
  const UTC_HOJE = /new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)/;
  const superficies: Record<string, RegExp> = {
    "src/app/(dashboard)/dashboard/reembolsos/page.tsx": /const hojeISO = hojeEmBrasilia\(\);/,
    "src/app/(public)/imoveis/[id]/property-detail.tsx": /sinaisDeConfianca\(property, hojeEmBrasilia\(\)\)/,
    "src/lib/barra-fixa-imovel.ts": /statusDisponibilidade\(p\.availableFrom, p\.hoje \?\? hojeEmBrasilia\(\)\)/,
  };
  for (const [arq, usa] of Object.entries(superficies)) {
    const s = semComentarios(ler(arq));
    assert.doesNotMatch(s, UTC_HOJE, `${arq}: hoje em UTC`);
    assert.match(s, usa, arq);
    assert.match(s, /import \{[^}]*\bhojeEmBrasilia\b[^}]*\} from "(@\/lib|\.)\/datas-brasilia(\.ts)?";/, `${arq}: importa da fonte`);
  }
});

// ── ORDEM-DUET-506 §2: os outros dois "−3 h" (o dia de um instante) consomem a fonte ────────────────────────────
import { dataEmBrasilia } from "./automacoes/regras.ts";
import { confirmacaoDevida } from "./estadia/jornada-mensagens.ts";
import { fonteSemComentarios as semComentarios } from "./fonte-sem-comentarios.ts";

test("E1115 (ORDEM-506): o dia de um instante sai de diaBRT — jornada-mensagens e automacoes sem −3 h fixas", () => {
  for (const arq of ["src/lib/estadia/jornada-mensagens.ts", "src/lib/automacoes/regras.ts"]) {
    const s = semComentarios(ler(arq));
    assert.doesNotMatch(s, /3 \* 3600_?000|3 \* 60 \* 60 \* 1000/, `${arq}: −3 h fixas`);
    assert.match(s, /import \{[^}]*\bdiaBRT\b[^}]*\} from "\.\.\/datas-brasilia\.ts";/, `${arq}: importa da fonte`);
    assert.match(s, /diaBRT\(/, arq);
  }
  // O mesmo dia, também entre as 21:00 e as 24:00 de Brasília.
  assert.equal(dataEmBrasilia("2026-11-23T02:30:00Z"), "2026-11-22");
  assert.equal(dataEmBrasilia(new Date("2026-11-23T03:00:00Z")), "2026-11-23");
  for (const iso of ["2026-11-23T02:30:00Z", "2026-02-15T01:00:00Z", "2026-07-01T23:59:00Z"]) assert.equal(dataEmBrasilia(iso), diaBRT(iso));
  // A janela de 1 dia da confirmação conta do dia da assinatura em Brasília (assinado 22/11 às 23:30 de Brasília).
  assert.equal(confirmacaoDevida({ assinadoEm: "2026-11-23T02:30:00Z", hoje: "2026-11-23" }), true);
  assert.equal(confirmacaoDevida({ assinadoEm: "2026-11-23T02:30:00Z", hoje: "2026-11-24" }), false);
});
