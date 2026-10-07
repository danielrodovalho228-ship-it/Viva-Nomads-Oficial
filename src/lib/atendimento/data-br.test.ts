/*
  Bug de 07/10 (logs da Vercel 18:07): weekday + dateStyle/timeStyle → TypeError
  "Invalid option" derrubava "Sugerir resposta" e a Viva. Roda: node --test src/lib/atendimento/data-br.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { agoraBRTexto } from "./data-br.ts";

test("formata em Brasília com dia da semana, sem lançar erro", () => {
  assert.equal(agoraBRTexto(new Date("2026-10-07T21:07:00Z")), "quarta-feira, 07/10/2026, 18:07");
  assert.equal(agoraBRTexto(new Date("2026-10-08T02:30:00Z")), "quarta-feira, 07/10/2026, 23:30");
});

test("a combinação que quebra continua quebrando (por isso o helper existe)", () => {
  assert.throws(() => new Date().toLocaleString("pt-BR", { weekday: "long", dateStyle: "short" } as Intl.DateTimeFormatOptions), TypeError);
});

test("nenhum arquivo de src mistura dateStyle/timeStyle com campos soltos no mesmo objeto", () => {
  const raiz = new URL("../../", import.meta.url).pathname;
  const ruins: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(ts|tsx)$/.test(n) && !n.endsWith(".test.ts")) {
        for (const obj of readFileSync(p, "utf8").match(/\{[^{}]*\b(dateStyle|timeStyle)\b[^{}]*\}/g) ?? []) {
          if (/\b(weekday|year|month|day|hour|minute|second|era|timeZoneName)\s*:/.test(obj)) ruins.push(`${p}: ${obj.slice(0, 120)}`);
        }
      }
    }
  };
  andar(raiz);
  assert.deepEqual(ruins, []);
});
